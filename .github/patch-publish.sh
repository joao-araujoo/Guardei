#!/usr/bin/env bash
set -uo pipefail

if [[ ! -f .github/capsule-patch-ready ]]; then
  echo "No staged patch found."
  exit 0
fi

cat .github/capsule-patch-parts/part-* > /tmp/capsule-changes.patch.gz.b64
encoded_hash="$(sha256sum /tmp/capsule-changes.patch.gz.b64 | cut -d' ' -f1)"
echo "encoded_sha256=${encoded_hash}"

if [[ "${encoded_hash}" != "c8620a003227f43820b3ac47136e55a83cc1bf9dc005e89d640cec33d73513d1" ]]; then
  echo "Encoded patch hash mismatch."
  exit 11
fi

if ! base64 --decode /tmp/capsule-changes.patch.gz.b64 | gzip --decompress > /tmp/capsule-changes.patch; then
  echo "Could not decode the staged patch."
  exit 12
fi

patch_hash="$(sha256sum /tmp/capsule-changes.patch | cut -d' ' -f1)"
echo "patch_sha256=${patch_hash}"

if [[ "${patch_hash}" != "67e50b79e56223432047871b49a6b2204aa5d212219e9c58e46c19ef67d38807" ]]; then
  echo "Decoded patch hash mismatch."
  exit 13
fi

git show 12b996f96fc845d68c701e31f642ff3fb766b1c8:.github/workflows/capsule-ci.yml > .github/workflows/capsule-ci.yml

if ! git apply --check /tmp/capsule-changes.patch 2> /tmp/capsule-apply-error.txt; then
  echo "Patch validation failed:"
  cat /tmp/capsule-apply-error.txt
  exit 14
fi

git apply /tmp/capsule-changes.patch
rm -rf .github/capsule-patch-parts
rm -f .github/capsule-patch-ready
rm -f .github/capsule-patch-diagnostic.txt
rm -f .github/patch-publish.sh
rm -f .github/workflows/apply-capsule-patch.yml

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -m "feat: implement intelligent content capsules"
git push origin HEAD:feat/intelligent-capsules
