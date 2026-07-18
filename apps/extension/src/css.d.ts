declare module "*.css";

/** Plasmo inlines the raw text of a file imported via the `data-text:` scheme. */
declare module "data-text:*" {
  const content: string;
  export default content;
}
