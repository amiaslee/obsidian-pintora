import { MarkdownPostProcessorContext, Menu, Notice, TFile, Modal, App, MarkdownView, MarkdownSectionInformation } from "obsidian";
import PintoraPlugin from "./main";
import pintora from '@pintora/standalone';
import { t } from "lang/helpers";
import { RendererType } from "@pintora/renderer/lib/renderers/index";
import { jsonrepair } from 'jsonrepair';

interface Processor {
  svg: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void>;
  canvas: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void>;
}


export class Processors implements Processor {
    plugin: PintoraPlugin;
    viewRegistered: boolean;

    constructor(plugin: PintoraPlugin) {
        this.plugin = plugin;
        this.viewRegistered = false;
    }

    default = async(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        await this.processor(source, this.plugin.settings.defaultRenderer, el, ctx);
    }

    canvas = async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        return await this.processor(source, "canvas", el, ctx);
    }

    svg = async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        return await this.processor(source, "svg", el, ctx);
    }

    processor = async (source: string, renderer: RendererType, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {

      const codeblockInfo = await ctx.getSectionInfo(el);
      const pintoraCodeBlock = codeblockInfo?.text.split('\n').slice(codeblockInfo.lineStart,(codeblockInfo.lineEnd + 1)).join('\n');
      const pintoraParam =  codeblockInfo?.text.split('\n')[ codeblockInfo.lineStart].split(' ').slice(1).join(' ');
      const pintoraParamJsonString = pintoraParam ? jsonrepair(pintoraParam) : null ;
      const pintoraParamJson = (typeof JSON.parse(pintoraParamJsonString) === "object")  ? JSON.parse(pintoraParamJsonString) : null;
        
      const commonConfigs = {
        edgeType: this.plugin.settings.edgeType,
        useMaxWidth: true,
        // edgeColor: this.plugin.settings.edgeColor
      }
      const themeVariablesInput = this.plugin.settings.themeVariables;
      const themeVariablesJsonString = themeVariablesInput ? jsonrepair(themeVariablesInput) : '';
      const themeVariables = themeVariablesJsonString ? JSON.parse(themeVariablesJsonString) : {}

      if(!source){ this.errorConsole(el,`Input content is empty.\n`); }

      await pintora.renderTo(source, {
        container: el,
        renderer: renderer,
        onError: (error: Error) => {
            this.errorConsole(el,error.message);
          },
        config: {
            core: {
                defaultRenderer: "svg",
                defaultFontFamily: "Times, ui-rounded, cursive",
                useMaxWidth: true
              }, 
            themeConfig: {
              theme: this.plugin.settings.theme,
              themeVariables: themeVariables
            },
            activity: commonConfigs,
            component: commonConfigs,
            er: commonConfigs,
            sequence: commonConfigs,
            mindmap: commonConfigs,
            dot: commonConfigs,
            class: commonConfigs,
            gantt: commonConfigs,
        }
      });
      
      const addWrapOpt = {
        addClass: ["pintora-wrap","accordion","active"], 
        addChild:`<div class="accordion-header">
        <div class="accordion-arrow"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up"><path d="m18 15-6-6-6 6"/></svg></div>
        <div class="accordion-label">Pintora</div></div>`
      }
      this.addWrap(el, addWrapOpt);
      el.classList.add('pintora-content','accordion-content');

      let pintoraTitle: string;
      if(pintoraParamJson) {
        pintoraTitle = pintoraParamJson.title;
        if(pintoraTitle){
            el.closest('.accordion').querySelector('.accordion-label').innerHTML = pintoraTitle;
        }
      } 

      setTimeout(async() => {
        await this.scaleElementToFitParent(el);
        await this.accordion(el,1);
      }, 100)
      
      el.addEventListener('contextmenu', async (event) => {

        const menu = new Menu();
            menu.addItem(items => {
                items
                    .setTitle(t("COPY_SOURCE_CODE"))
                    .setIcon('copy')
                    .onClick(async () => {
                        await navigator.clipboard.writeText(source);
                        new Notice(t("COPY_SUCCESS_NOTICE"));
                    })
            });

            menu.addSeparator()

            menu.addItem(items => {
                items
                    .setTitle(t("COPY_DIAGRAM"))
                    .setIcon('clipboard-copy')
                    .setSubmenu()
                        .addItem(item => {
                            item
                            .setTitle(t("COPY_PNG_BASE64"))
                            .setIcon('type')
                            .onClick(async () => {
                                const canvas = await this.getDiagramData('canvas',source, el, ctx);
                                await new Promise(resolve => requestAnimationFrame(resolve));
                                const base64 = await canvas.toDataURL("image/png");
                                await navigator.clipboard.writeText(base64);
                                new Notice(t("COPY_SUCCESS_NOTICE"));
                            });
                        }) 
                        .addItem(item => {
                            item
                            .setTitle(t("COPY_SVG_XML"))
                            .setIcon('code')
                            .onClick(async () => {
                                const svg = (await this.getDiagramData('svg',source, el, ctx));
                                await navigator.clipboard.writeText(svg.outerHTML);
                                new Notice(t("COPY_SUCCESS_NOTICE"));
                            });
                        })
                        .addItem(item => {
                            item
                            .setTitle(t("COPY_PNG_BLOB"))
                            .setIcon('image')
                            .onClick(async () => {
                                const canvas = await this.getDiagramData('canvas',source, el, ctx);
                                await new Promise(resolve => requestAnimationFrame(resolve));
                                this.renderToBlob(
                                    canvas,
                                    "image/png",
                                    t("COPY_DIAGRAM_NOTICE_ERR"),
                                    async (blob) => {
                                        await navigator.clipboard.write([
                                            new ClipboardItem({
                                                "image/png": blob
                                            })
                                        ]);
                                        new Notice(t("COPY_SUCCESS_NOTICE"));
                                    });
                            });
                        })
            })

            const viewMode = this.plugin.app.workspace.getActiveViewOfType(MarkdownView).getMode();

            menu.addSeparator()

            menu.addItem(items => {
                items
                    .setTitle(t("EXPORT_DIAGRAM"))
                    .setIcon('link')
                    .setSubmenu()
                    .addItem(item => { 
                        item
                        .setTitle(t("EXPORT_MD_DIAGRAM"))
                        .setIcon('file-type')
                        .onClick(async () => {
                            await this.exportDiagram(source, ctx, pintoraCodeBlock, pintoraTitle, true, null, null, 'md');
                        });
                    })
                    .addItem(item => {
                        item
                        .setTitle(t("EXPORT_PNG_DIAGRAM"))
                        .setIcon('image')
                        .onClick(async () => {
                            const canvas = await this.getDiagramData('canvas',source, el, ctx);
                            await new Promise(resolve => requestAnimationFrame(resolve));
                            this.renderToBlob(canvas, "image/png", t("GENERATE_LINK_NOTICE_ERR"), async (blob) => {
                                const buffer = await blob.arrayBuffer();
                                await this.exportDiagram(source, ctx, pintoraCodeBlock, pintoraTitle, false, buffer, null, 'png');
                            })
                        }) 
                    }) 
                    .addItem(item => {
                        item
                        .setTitle(t("EXPORT_SVG_DIAGRAM"))
                        .setIcon('file-code')
                        .onClick(async () => {
                            const svg = await this.getDiagramData('svg',source, el, ctx);
                            await new Promise(resolve => requestAnimationFrame(resolve));
                            svg.removeAttribute("viewBox");
                            svg.removeAttribute("preserveAspectRatio", "xMidYMid meet");
                            await this.exportDiagram(source, ctx, pintoraCodeBlock, pintoraTitle, false, null, svg.outerHTML, 'svg');
                        });
                    })
                    .addItem(item => {
                        item
                        .setTitle(t("EXPORT_WEBP_DIAGRAM"))
                        .setIcon('app-window')
                        .onClick(async () => {
                            const canvas = await this.getDiagramData('canvas',source, el, ctx);
                            await new Promise(resolve => requestAnimationFrame(resolve));
                            this.renderToBlob(canvas, "image/webp", t("GENERATE_LINK_NOTICE_ERR"), async (blob) => {
                                const buffer = await blob.arrayBuffer();
                                await this.exportDiagram(source, ctx, pintoraCodeBlock, pintoraTitle, false, buffer, null, 'webp');
                            })
                        });
                    }) 
            });

            menu.addSeparator()

            menu.addItem(items => {
                if(viewMode === "preview"){ items.setDisabled(true); }
                items
                    .setTitle(t("GENERATE_LINK"))
                    .setIcon('link')
                    .setSubmenu()
                    .addItem(item => { 
                        item
                        .setTitle(t("GENERATE_MD_LINK"))
                        .setIcon('file-type')
                        .onClick(async () => {
                            await this.exportDiagramLink(source, ctx, pintoraCodeBlock, pintoraTitle, codeblockInfo, true, null, null, '');
                        });
                    })
                    .addItem(item => {
                        item
                        .setTitle(t("GENERATE_PNG_LINK"))
                        .setIcon('image')
                        .onClick(async () => {
                            const canvas = await this.getDiagramData('canvas',source, el, ctx);
                            await new Promise(resolve => requestAnimationFrame(resolve));
                            this.renderToBlob(canvas, "image/png", t("GENERATE_LINK_NOTICE_ERR"), async (blob) => {
                                const buffer = await blob.arrayBuffer();
                                await this.exportDiagramLink(source, ctx, pintoraCodeBlock, pintoraTitle, codeblockInfo, false, buffer, null, 'png');
                            })
                        }) 
                    }) 
                    .addItem(item => {
                        item
                        .setTitle(t("GENERATE_SVG_LINK"))
                        .setIcon('file-code')
                        .onClick(async () => {
                            const svg = await this.getDiagramData('svg',source, el, ctx);
                            await new Promise(resolve => requestAnimationFrame(resolve));
                            svg.removeAttribute("viewBox");
                            svg.removeAttribute("preserveAspectRatio", "xMidYMid meet");
                            await this.exportDiagramLink(source, ctx, pintoraCodeBlock, pintoraTitle, codeblockInfo, false, null, svg.outerHTML, 'svg');
                        });
                    })
                    .addItem(item => {
                        item
                        .setTitle(t("GENERATE_WEBP_LINK"))
                        .setIcon('app-window')
                        .onClick(async () => {
                            const canvas = await this.getDiagramData('canvas',source, el, ctx);
                            await new Promise(resolve => requestAnimationFrame(resolve));
                            this.renderToBlob(canvas, "image/webp", t("GENERATE_LINK_NOTICE_ERR"), async (blob) => {
                                const buffer = await blob.arrayBuffer();
                                await this.exportDiagramLink(source, ctx, pintoraCodeBlock, pintoraTitle, codeblockInfo, false, buffer, null, 'webp');
                            })
                        });
                    })
                    .addItem(item => {
                        item
                        .setTitle(t("GENERATE_PNG_BASE64_LINK"))
                        .setIcon('link-2')
                        .onClick(async () => {
                            const canvas = await this.getDiagramData('canvas',source, el, ctx);
                            await new Promise(resolve => requestAnimationFrame(resolve));
                            const base64 = await canvas.toDataURL("image/png");
                            await this.exportDiagramLink(source, ctx, pintoraCodeBlock, pintoraTitle, codeblockInfo, false, null, base64, 'base64');
                        });
                    }) 
            });

        menu.showAtMouseEvent(event);
    });

    el.addEventListener('click', async (event) => {
        const diagram: any = el.querySelector('canvas') || el.querySelector('svg');
        if(diagram.id === "pintora-console-error-svg"){ return false; }
        let clonedDiagram: any = diagram.cloneNode(true);
        if (diagram instanceof HTMLCanvasElement) {
            const originalContext = diagram.getContext('2d');
            const clonedContext = clonedDiagram.getContext('2d');
            if (originalContext && clonedContext) {
                clonedContext.drawImage(diagram, 0, 0);
            }
        }
        const modal = new pintoraPluginModal(this.plugin.app, clonedDiagram);
        modal.open();
    });

  }

  errorConsole(el:HTMLElement, message:string){
    const errorDiv = document.createElement('div');
    const errorTitle = `<div class="pintora-console-error-title"><svg id="pintora-console-error-svg" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm4.207 12.793-1.414 1.414L12 13.414l-2.793 2.793-1.414-1.414L10.586 12 7.793 9.207l1.414-1.414L12 10.586l2.793-2.793 1.414 1.414L13.414 12l2.793 2.793z"></path></svg>&nbsp;&nbsp;<div class="console-error-triangle">▶</div>&nbsp;Error</div>`;
    message = errorTitle + message;
    errorDiv.innerHTML = message.replace(/\n/g,'<br>');
    errorDiv.classList.add('pintora-console-error');
    el.appendChild(errorDiv);
  }

  async getDiagramData(type: string, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    let result: any = null;
    if (type === "canvas") {
        const tempCanvasDiv = document.createElement('div');
        await this.canvas(source, tempCanvasDiv, ctx);
        result = tempCanvasDiv.querySelector('canvas');
        tempCanvasDiv.remove(); 
    } else if (type === "svg") {
        const tempSvgDiv = document.createElement('div');
        await this.svg(source, tempSvgDiv, ctx);
        result = tempSvgDiv.querySelector('svg');
        if (!result.hasAttribute('xmlns')) {
            result.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        tempSvgDiv.remove();
    }
    return result;
  }

  async exportDiagram(source: string, ctx: MarkdownPostProcessorContext, pintoraCodeBlock: string | undefined, pintoraTitle: string, isMarkdown: boolean, diagramData: ArrayBuffer | null, data: string | null, diagramType: string){
    const documentPath = this.plugin.app.vault.getAbstractFileByPath(ctx.sourcePath)?.path;
    const documentPathLink = `---\n${t("SOURCE_PATH")}:\n    ${documentPath}\n---\n`;
    const pintoraMarkdownLinked = `${documentPathLink}${ pintoraCodeBlock }\n`;
    const markdownTitle = pintoraTitle ? pintoraTitle : '';
    if(!isMarkdown){
        if(diagramType === "png" || diagramType === "webp"){
            await this.saveFile(source, ctx, diagramType, null, diagramData, markdownTitle);
        } else {
            await this.saveFile(source, ctx, diagramType, data, null, markdownTitle);
        }
    } else {
        await this.saveFile(source, ctx, 'md', pintoraMarkdownLinked, null, markdownTitle);
    }
  }
  
  async exportDiagramLink(source: string, ctx: MarkdownPostProcessorContext, pintoraCodeBlock: string | undefined, pintoraTitle: string, codeblockInfo: MarkdownSectionInformation | null, isMarkdown: boolean, diagramData: ArrayBuffer | null, data: string | null, diagramType: string){
    const documentPath = this.plugin.app.vault.getAbstractFileByPath(ctx.sourcePath)?.path;
    const documentPathLink = `---\n${t("SOURCE_PATH")}:\n    ${documentPath}\n---\n`;
    const pintoraMarkdownLinked = `${documentPathLink}${ pintoraCodeBlock }\n`;
    const markdownTitle = pintoraTitle ? pintoraTitle : '';
    const attachmentPath = await this.saveFile(source, ctx, 'md', pintoraMarkdownLinked, null, markdownTitle);
    const attachmentName = attachmentPath?.split('/')[(attachmentPath?.split('/').length - 1)].split('.')[0];
    let attachmentLink = `![${attachmentName}](${attachmentPath} "${attachmentName}")\n`;
    if(!isMarkdown){ 
        let diagramPath;
        if(diagramType === "png" || diagramType === "webp"){
            diagramPath = await this.saveFile(source, ctx, diagramType, null, diagramData, markdownTitle);
        } else if(diagramType === "base64"){
            diagramPath = data;
        } else {
            diagramPath = await this.saveFile(source, ctx, diagramType, data, null, markdownTitle);
        }
        const diagramLink = `![${attachmentName}](${diagramPath} "${attachmentName}")\n`;
        const backupLink = `${t("PINTORA_CODE_BACKUP_LINK")} [${ attachmentName }](${attachmentPath} "${attachmentName}")`;
        attachmentLink = diagramLink + backupLink; 
    }
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const newContent = codeblockInfo?.text.replace(pintoraCodeBlock,attachmentLink);
    view.editor.setValue(newContent);
    this.plugin.refreshEditor();
  }

  canvasToIMG(canvas: HTMLCanvasElement) {
    const dataURL = canvas.toDataURL();
    const img = new Image();
    img.src = dataURL;
    return img;
  }

  scaleElementToFitParent(el: HTMLElement) {
    let parentWidth = el.offsetWidth;
    const diagramEl = el?.querySelector('canvas') || el?.querySelector('svg');
    if (diagramEl) {
        let aspectRatio;
        if (diagramEl instanceof HTMLCanvasElement) {
            aspectRatio = diagramEl.width / diagramEl.height;
        } else if (diagramEl instanceof SVGElement) {
            if(diagramEl.id === "pintora-console-error-svg"){ return false; }
            if (!diagramEl.hasAttribute('xmlns')) {
                diagramEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }
            const bbox = diagramEl.getBBox();
            aspectRatio = bbox.width / bbox.height;

            diagramEl.setAttribute("viewBox", `0 0 ${bbox.width} ${bbox.height}`);
            diagramEl.setAttribute("preserveAspectRatio", "xMidYMid meet");

            diagramEl.style.width = `${parentWidth}px`;
            diagramEl.style.height = `${parentWidth / aspectRatio}px`;
        }
    }
}


scaleElement(parentEl: HTMLElement, childEl: HTMLElement) {
    let computedStyle = getComputedStyle(parentEl);
    let parentMaxWidth = parseFloat(computedStyle.maxWidth.replace('px', '')) || parentEl.offsetWidth;
    let parentMaxHeight = parseFloat(computedStyle.maxHeight.replace('px', '')) || parentEl.offsetHeight;

    let childWidth: number, childHeight: number;

    if (childEl instanceof HTMLCanvasElement) {
        childWidth = childEl.width;
        childHeight = childEl.height;
    } 
    else if (childEl instanceof SVGElement) {
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

    if (childEl instanceof SVGElement) {
        const bbox = childEl.getBBox();
        childEl.setAttribute("viewBox", `0 0 ${bbox.width} ${bbox.height}`);
    }
}

  addWrap(selector: string | HTMLElement | undefined, options = {}) {
    const element = typeof selector === 'string' ? document.querySelector(selector) : typeof selector === 'object' ? selector : undefined;
    if(!element){return false;}
    const wrap = document.createElement('div');
    const wrapOptions = {
        addClass: '',
        addChild: '',
        overlay: '',
        progress: '',
        removeElStyle: false,
        addPadding: '',
        ...options
    }
    if(wrapOptions.addClass){
        wrap.classList.add(...wrapOptions.addClass);
    }
    if(wrapOptions.addChild){
        const parser = new DOMParser();
        const doc = parser.parseFromString(wrapOptions.addChild, 'text/html');
        wrap.appendChild(doc.body.firstChild);
    }
    if(wrapOptions.overlay){
        const overlayEl = document.createElement('div');
        overlayEl.classList.add(wrapOptions.overlay);
        if(wrapOptions.progress){ overlayEl.innerHTML = wrapOptions.progress; }
        wrap.appendChild(overlayEl);
    }
    if(wrapOptions.removeElStyle){
        element.removeAttribute('class');
        element.removeAttribute('style');
    }
    if(wrapOptions.addPadding){
        wrap.style.padding = wrapOptions.addPadding;
    }
    element.parentNode?.insertBefore(wrap, element);
    wrap.appendChild(element);
  }

  accordion(el: HTMLElement,time: number){
    const accordionhave = document.querySelector('.accordion');
    if (accordionhave) {
      const accordions = document.querySelectorAll('.accordion');
      accordions.forEach(accordion => {
        const header = accordion.querySelector('.accordion-header');
        const content = accordion.querySelector('.accordion-content');
        const diagramEl = content?.firstElementChild;
        let contentHeight = diagramEl ? window.getComputedStyle(diagramEl).height : 0 ;
        let isCollapsed = true;
        function CollapsedL() {
          isCollapsed = !isCollapsed;
          if (isCollapsed) {
            content.style.maxHeight = null;
            accordion.classList.remove('active');
          } else {
            content.style.maxHeight = contentHeight;
            accordion.classList.add('active');
          }
        }
        header.removeEventListener('click',CollapsedL);
        header.addEventListener('click',CollapsedL);
        
        if (accordion.classList.contains('active')) {
            isCollapsed = false;
            setTimeout(() => {
              content.style.maxHeight = contentHeight;
            }, time);
          }
          
      });
    }
  }
  
  renderToBlob = (canvas: HTMLCanvasElement, MIME: string, errorMessage: string, handleBlob: (blob: Blob) => Promise<void>) => {
    try {
        canvas.toBlob(async (blob: Blob) => {
            try {
                await handleBlob(blob);
            } catch (error) {
                new Notice(errorMessage);
                console.error(error);
            }
        },MIME);
    } catch (error) {
        new Notice(errorMessage);
        console.error(error);
    }
}
 
getFilename = (source: string, ctx: MarkdownPostProcessorContext) => {
    const now = Math.floor(Date.now() / 1000);
    const filename = this.plugin.app.vault.getAbstractFileByPath(ctx.sourcePath)?.name;
    return `${filename?.substring(0, filename.lastIndexOf('.'))}-Pintora-${now}`;
}

getFolder = async (ctx: MarkdownPostProcessorContext) => {
    let exportPath = this.plugin.settings.exportPath;
    if (!exportPath.startsWith('/')) {
        // relative to the document
        const documentPath = this.plugin.app.vault.getAbstractFileByPath(ctx.sourcePath)?.parent;
        exportPath = `${documentPath?.path}/${exportPath}`;
    }

    const exists = await this.plugin.app.vault.adapter.exists(exportPath);
    if (!exists) {
        this.plugin.app.vault.createFolder(exportPath);
    }

    return exportPath;
}

getFilePath = async (source: string, ctx: MarkdownPostProcessorContext, type: string,title: string | null) => {
    let filename = this.getFilename(source, ctx);
    if(title){ filename = title; }
    const path = await this.getFolder(ctx);
    return `${path}${filename}.${type}`;
}

getFile = (fileName: string) => {

    let fName = fileName;
    if (fName.startsWith('/')) {
        fName = fName.substring(1);
    }

    const folderOrFile = this.plugin.app.vault.getAbstractFileByPath(fName);

    if (folderOrFile instanceof TFile) {
        return folderOrFile;
    }

    return undefined;
}

saveFile = async (source: string, ctx: MarkdownPostProcessorContext, type: string, data: string | null, buffer: ArrayBuffer | null, title: string | null) => {
    try {
        const filename = await this.getFilePath(source, ctx, type, title);
        const file = this.getFile(filename);

        if(data){
            if (file) {
                await this.plugin.app.vault.modify(file, data);
            } else {
                await this.plugin.app.vault.create(filename, data);
            }
        }
        if(buffer){
            if (file) {
                await this.plugin.app.vault.modifyBinary(file, buffer);
            } else {
                await this.plugin.app.vault.createBinary(filename, buffer);
            }
        }
        
        new Notice(`${t("GENERATE_LINK_NOTICE")}'${filename}'`);
        return filename;
    } catch (error) {
        new Notice(t("GENERATE_LINK_NOTICE_ERR"));
        console.error(error);
    }
}

}


class pintoraPluginModal extends Modal {
    diagram: any;
    plugin: PintoraPlugin;

	constructor(app: App, diagram: any ) {
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
      const processers = new Processors(this.plugin);
      processers.scaleElement(modalParentEl,this.diagram);
	}
  
	onClose() {
	  let { contentEl } = this;
	  contentEl.empty();
     
	}
  }