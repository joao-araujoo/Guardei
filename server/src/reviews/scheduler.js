export const REVIEW_INTERVAL_LIMITS = Object.freeze({ min: 1, max: 365 });
export const EASE_LIMITS = Object.freeze({ min: 1.3, max: 3.2 });
export const REVIEW_RATINGS = Object.freeze(["again", "hard", "good", "easy"]);

export function scheduleNextReview(card = {}, rating, options = {}) {
  if (!REVIEW_RATINGS.includes(rating)) throw inputError("REVIEW_RATING_INVALID", "A avaliacao da revisao e invalida.");

  const now = validDate(options.now) || new Date();
  const previousDueAt = validDate(options.previousDueAt || card.nextReviewAt) || now;
  const previousInterval = clampInt(card.intervalDays, 0, REVIEW_INTERVAL_LIMITS.max, 0);
  const previousRepetitions = clampInt(card.repetitions, 0, 10_000, 0);
  const previousEase = clampNumber(card.easeFactor, EASE_LIMITS.min, EASE_LIMITS.max, 2.5);
  const confidence = clampInt(options.confidence, 1, 5, 3);
  const overdueDays = Math.max(0, Math.floor((now.getTime() - previousDueAt.getTime()) / 86_400_000));

  let repetitions = previousRepetitions;
  let easeFactor = previousEase;
  let intervalDays = REVIEW_INTERVAL_LIMITS.min;

  if (rating === "again") {
    repetitions = 0;
    easeFactor -= 0.22;
    intervalDays = 1;
  } else if (rating === "hard") {
    repetitions += 1;
    easeFactor -= 0.15;
    intervalDays = previousInterval <= 1 ? 1 : Math.ceil(previousInterval * 1.2);
  } else if (rating === "good") {
    repetitions += 1;
    easeFactor += confidence >= 4 ? 0.04 : confidence <= 2 ? -0.04 : 0;
    if (previousRepetitions === 0) intervalDays = 1;
    else if (previousRepetitions === 1) intervalDays = 3;
    else intervalDays = Math.round(Math.max(1, previousInterval) * easeFactor * confidenceMultiplier(confidence));
  } else {
    repetitions += 1;
    easeFactor += 0.15 + (confidence >= 4 ? 0.05 : 0);
    if (previousRepetitions === 0) intervalDays = 3;
    else if (previousRepetitions === 1) intervalDays = 7;
    else intervalDays = Math.round(Math.max(1, previousInterval) * easeFactor * 1.3 * confidenceMultiplier(confidence));
  }

  if (["good", "easy"].includes(rating) && previousInterval > 0 && overdueDays > 0) {
    const delayRatio = Math.min(1, overdueDays / Math.max(1, previousInterval));
    intervalDays = Math.round(intervalDays * (1 + delayRatio * 0.15));
  }

  easeFactor = round(clampNumber(easeFactor, EASE_LIMITS.min, EASE_LIMITS.max, 2.5), 2);
  intervalDays = clampInt(intervalDays, REVIEW_INTERVAL_LIMITS.min, REVIEW_INTERVAL_LIMITS.max, 1);
  const nextReviewAt = new Date(now.getTime() + intervalDays * 86_400_000);
  if (Number.isNaN(nextReviewAt.getTime())) throw inputError("REVIEW_DATE_INVALID", "Nao foi possivel calcular a proxima revisao.");

  return {
    previousInterval,
    intervalDays,
    repetitions,
    easeFactor,
    nextReviewAt,
    overdueDays,
  };
}

function confidenceMultiplier(confidence) {
  return { 1: 0.82, 2: 0.9, 3: 1, 4: 1.06, 5: 1.12 }[confidence] || 1;
}

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function round(value, decimals) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function inputError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}
