/**
 * Helpers para fallback de fechamento e animação top-layer em <dialog> nativos.
 */

let cachedSupportsDisplayTransition: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (typeof window === "undefined" || !document.body) return false;
  if (cachedSupportsDisplayTransition !== undefined) {
    return cachedSupportsDisplayTransition;
  }
  if (!window.CSS?.supports?.("transition-behavior", "allow-discrete")) {
    cachedSupportsDisplayTransition = false;
    return false;
  }
  const probe = document.createElement("div");
  probe.style.cssText =
    "transition: display 1s allow-discrete !important; display: block;";
  document.body.appendChild(probe);
  const beforeDisplay = getComputedStyle(probe).display;
  probe.style.display = "none";
  cachedSupportsDisplayTransition =
    beforeDisplay === "block" && getComputedStyle(probe).display === "block";
  probe.remove();
  return cachedSupportsDisplayTransition;
}

function supportsTopLayerExit(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.CSS?.supports?.("overlay", "auto") && canTransitionDisplay());
}

export async function closeTopLayerDialog(dialog: HTMLDialogElement | null): Promise<void> {
  if (!dialog || !dialog.open) return;

  if (!supportsTopLayerExit()) {
    dialog.setAttribute("data-closing", "");
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    }
    if (!dialog.hasAttribute("data-closing")) return;
    dialog.removeAttribute("data-closing");
  }

  if (dialog.open) {
    dialog.close();
  }
}

export function bindDialogFallbacks(
  dialog: HTMLDialogElement,
  onDismiss: () => void
): () => void {
  const handleCancel = (event: Event) => {
    event.preventDefault();
    void closeTopLayerDialog(dialog).then(onDismiss);
  };

  dialog.addEventListener("cancel", handleCancel);

  let cleanupLightDismiss: (() => void) | undefined;
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    let pressedOutside = false;
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        void closeTopLayerDialog(dialog).then(onDismiss);
      }
      pressedOutside = false;
    };

    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("pointerup", onPointerUp);

    cleanupLightDismiss = () => {
      dialog.removeEventListener("pointerdown", onPointerDown);
      dialog.removeEventListener("pointerup", onPointerUp);
    };
  }

  return () => {
    dialog.removeEventListener("cancel", handleCancel);
    cleanupLightDismiss?.();
  };
}
