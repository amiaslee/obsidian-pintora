import { Plugin, MarkdownView, Notice } from 'obsidian';
import { Processors } from "./processor";
import { DEFAULT_SETTINGS, PintoraPluginSettings, PintoraSettingsTab } from "./settings"
import { t } from "lang/helpers"

export default class PintoraPlugin extends Plugin {
	settings: PintoraPluginSettings;

	async onload() {

		await this.loadSettings();
		this.addSettingTab(new PintoraSettingsTab(this.app, this)); 

		const processor = new Processors(this);
		this.registerMarkdownCodeBlockProcessor("pintora",processor.default);
		this.registerMarkdownCodeBlockProcessor("pintora-svg",processor.svg);
		this.registerMarkdownCodeBlockProcessor("pintora-canvas",processor.canvas);
		
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
			  const main = menu.addSeparator()
			  	.addItem((items) => {
				items.setSection("info")
				  .setTitle(t("COPY_PATH"))
				  .setIcon("copy")
				  .onClick(async () => {
					await navigator.clipboard.writeText(file.path);
					new Notice(t("COPY_SUCCESS_NOTICE"));
				  })
			 	})
			})
		  );

		  this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
			  menu.addItem((item) => {
				item
				  .setTitle(t("REFRESH_DOCUMENT"))
				  .setIcon("rotate-cw")
				  .onClick(async () => {
					this.refreshEditor();
				  });
			  });
			})
		  );
		  
	}

	  async refreshEditor() {
		this.app.workspace.getLeavesOfType("markdown").forEach(async (leaf) => {
			const state = leaf.getViewState();
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			const scrollInfo =  view?.editor.getScrollInfo();
			await leaf.setViewState({ type: "empty" });
			await leaf.setViewState(state);
			const scrollEl = document.querySelector('.cm-scroller');
			if(scrollEl){
				scrollEl.scrollTo({
					top: scrollInfo?.top,
					left: scrollInfo?.left,
					behavior: "instant",
				});
			}
		  });
	  }

	onunload() { }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}

