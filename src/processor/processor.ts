import { addIcon, MarkdownPostProcessorContext, MarkdownSectionInformation, setIcon } from "obsidian";
import PintoraPlugin from "../main";
import { addEventListeners } from "./eventListeners";
import pintora, { DeepPartial, PintoraConfig } from '@pintora/standalone';
import { RendererType } from "@pintora/renderer/lib/renderers/index";
import { Utility } from "./utils";

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
      const utility = new Utility(this.plugin);

      const codeblockInfo = ctx.getSectionInfo(el);
      const pintoraCodeBlock = codeblockInfo?.text.split('\n').slice(codeblockInfo.lineStart,(codeblockInfo.lineEnd + 1)).join('\n');
      const pintoraParam =  codeblockInfo?.text.split('\n')[ codeblockInfo.lineStart].split(' ').slice(1).join(' ');
      const pintoraParamJson = utility.parsePintoraParam(pintoraParam);
    
      if(!source){ utility.errorConsole(el,`Input content is empty.\n`); }

      const themeVariables = utility.parsePintoraParam(this.plugin.settings.themeVariables);
      const commonConfigs = {
        edgeType: this.plugin.settings.edgeType,
        useMaxWidth: true,
      }

      pintora.renderTo(source, {
            container: el,
            renderer: renderer,
            onError: (error: Error) => {
                utility.errorConsole(el, error.message);
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
            } as DeepPartial<PintoraConfig>
        });
      
      const addWrapOpt = {
        addClass: ["pintora-wrap","accordion","active"], 
        addChild:`<div class="accordion-header">
        <div class="accordion-arrow"></div>
        <div class="accordion-label">Pintora</div></div>`
      }
      const wrap = utility.addWrap(el, addWrapOpt);
      const arrow: HTMLElement | null | undefined = wrap?.querySelector('.accordion-arrow');
      if(arrow){ setIcon(arrow,'chevron-up'); }
      el.classList.add('pintora-content','accordion-content');

      setTimeout(async() => {
        await utility.scaleElementToFitParent(el);
        await utility.accordion(1);
      }, 100)

      let pintoraTitle = pintoraParamJson?.title || '';

      const accordionLabel = el.closest('.accordion')?.querySelector('.accordion-label');
      if (pintoraTitle && accordionLabel) {
        accordionLabel.textContent = pintoraTitle;
      }

      addEventListeners(this.plugin, source, el, ctx, pintoraCodeBlock as string, pintoraTitle, codeblockInfo as MarkdownSectionInformation);
      
  }
}



