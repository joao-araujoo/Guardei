const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "";

export async function classifySavedLink({ url, title = "", description = "" }) {
  const response = await fetch(`${API_BASE_URL}/api/ai/enrich-video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      title,
      description,
      text: description,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);

    throw new Error(
      errorData?.message || "Nao foi possivel classificar o link com IA."
    );
  }

  return response.json();
}
