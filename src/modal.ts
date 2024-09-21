import { Modal, App } from "obsidian";
import PintoraPlugin from "./main";

export class pintoraPluginModal extends Modal {
  diagram: any;
  plugin: PintoraPlugin;

  constructor(app: App, diagram: any) {
    super(app);
    this.diagram = diagram;
  }

  onOpen() {
    let { contentEl } = this;
    const modalParentEl = contentEl.closest('.modal');
    modalParentEl?.classList.add('modal-pintora');
    const modalCloseBtn = modalParentEl?.querySelector('.modal-close-button');
    modalCloseBtn?.classList.add('modal-pintora-closeBtn');
    contentEl.classList.add('modal-pintora-content');
    contentEl.append(this.diagram);
    this.scaleElement(modalParentEl as HTMLElement, this.diagram);
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }

  scaleElement(parentEl: HTMLElement, childEl: HTMLElement | HTMLCanvasElement | SVGGraphicsElement) {
    let computedStyle = getComputedStyle(parentEl);
    let parentMaxWidth = parseFloat(computedStyle.maxWidth.replace('px', '')) || parentEl.offsetWidth;
    let parentMaxHeight = parseFloat(computedStyle.maxHeight.replace('px', '')) || parentEl.offsetHeight;

    let childWidth: number, childHeight: number;

    if (childEl instanceof HTMLCanvasElement) {
      childWidth = childEl.width;
      childHeight = childEl.height;
    }
    else if (childEl instanceof SVGGraphicsElement) {
      const bbox = childEl.getBBox();
      childWidth = bbox.width;
      childHeight = bbox.height;
    } else {
      childWidth = parseFloat(childEl.getAttribute('width') || '0');
      childHeight = parseFloat(childEl.getAttribute('height') || '0');
    }

    let aspectRatio = childWidth / childHeight;

    let newWidth = parentMaxWidth;
    let newHeight = parentMaxWidth / aspectRatio;

    if (newHeight > parentMaxHeight) {
      newHeight = parentMaxHeight;
      newWidth = parentMaxHeight * aspectRatio;
    }

    childEl.style.width = `${newWidth}px`;
    childEl.style.height = `${newHeight}px`;

    parentEl.style.width = `${newWidth}px`;
    parentEl.style.height = `${newHeight}px`;

    if (childEl instanceof SVGGraphicsElement) {
      const bbox = childEl.getBBox();
      childEl.setAttribute("viewBox", `0 0 ${bbox.width} ${bbox.height}`);
    }
  }

}