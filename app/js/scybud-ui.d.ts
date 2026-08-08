declare module "https://scybud.github.io/scybud-ui/js/ui.js" {
  export function loadComponent(
    path: string,
    containerId: string,
  ): Promise<void>;

  export function createEmptyState(options: {
    container: HTMLElement;
    icon?: string;
    title: string;
    description?: string;
    actionText?: string;
    onAction?: () => void | Promise<void>;
  }): Promise<void>;
}
