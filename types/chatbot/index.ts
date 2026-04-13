export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

export type ExtractFromUrlRequest = {
  url: string;
  question: string;
};

export type ExtractImagesResult = {
  imageUrls: string[];
  screenshotBase64: string;
};
