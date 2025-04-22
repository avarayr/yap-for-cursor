declare module "worker:*" {
  const inlineWorker: string;
  export default inlineWorker;
}

declare module "*.css" {
  const content: string;
  export default content;
}
