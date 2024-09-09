import { App, PluginSettingTab, Setting } from "obsidian";
import PintoraPlugin from "./main"
import { t } from "lang/helpers"
import { RendererType } from "@pintora/renderer/lib/renderers/index"

export interface PintoraPluginSettings {
	defaultRenderer: RendererType,
    exportPath: string,
	theme: string,
	edgeType: string,
	edgeColor: string,
	themeVariables: string,
}

export const DEFAULT_SETTINGS: PintoraPluginSettings = {
	theme: 'default',
	defaultRenderer: 'svg',
    exportPath: 'attachments/',
	edgeType: 'ortho',
	edgeColor: '#000000',
	themeVariables: '',
}

export class PintoraSettingsTab extends PluginSettingTab {
	plugin: PintoraPlugin;

	constructor(app: App, plugin: PintoraPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName(t("DEFAULT_RENDERER_NAME"))
			.setDesc(t("DEFAULT_RENDERER_DESC"))
			.addDropdown(text => text
				.addOption('svg','SVG')
				.addOption('canvas','Canvas')
				.setValue(this.plugin.settings.defaultRenderer)
				.onChange(async (value: RendererType) => {
					this.plugin.settings.defaultRenderer = value;
					await this.plugin.saveSettings();
					this.plugin.refreshEditor();
			}));

		new Setting(containerEl)
			.setName(t("EXPORT_PATH_NAME"))
			.setDesc(t("EXPORT_PATH_DESC"))
			.addText(text => text
				.setPlaceholder(t("EXPORT_PATH_PLACEHOLDER"))
				.setValue(this.plugin.settings.exportPath)
				.onChange(async (value) => {
					this.plugin.settings.exportPath = value;
					await this.plugin.saveSettings();
					this.plugin.refreshEditor();
			}));
		
			new Setting(containerEl)
			.setName(t("THEME_NAME"))
			.setDesc(t("THEME_DESC"))
			.addDropdown(text => text
				.addOption('default','Default')
				.addOption('dark','Dark')
				.addOption('larkLight','Larklight')
				.addOption('larkDark','Larkdark')
				.setValue(this.plugin.settings.theme)
				.onChange(async (value) => {
					this.plugin.settings.theme = value;
					await this.plugin.saveSettings();
					this.plugin.refreshEditor();
			}));

		new Setting(containerEl)
			.setName(t("EDGE_TYPE_NAME"))
			.setDesc(t("EDGE_TYPE_DESC"))
			.addDropdown(text => text
				.addOption('polyline',t("EDGE_TYPE_POLYLINE"))
				.addOption('ortho',t("EDGE_TYPE_ORTHO"))
				.addOption('curved',t("EDGE_TYPE_CURVED"))
				.setValue(this.plugin.settings.edgeType)
				.onChange(async (value) => {
					this.plugin.settings.edgeType = value;
					await this.plugin.saveSettings();
					this.plugin.refreshEditor();
			}));

		/*
		const edgeColorBtn = new Setting(containerEl)
			.setName(t("EDGE_COLOR_NAME"))
			.setDesc(t("EDGE_COLOR_DESC"))
			.addExtraButton(color => color
				.setIcon('rotate-ccw')
				.setTooltip(t("RESTORE_DEFAULTS"))
				.onClick(async () => {
					this.plugin.settings.edgeColor = DEFAULT_SETTINGS.edgeColor;
					this.plugin.saveSettings();
					const colorPicker = edgeColorBtn.settingEl.querySelector('input');
					if(colorPicker){ colorPicker.value = this.plugin.settings.edgeColor; }
					this.plugin.refreshEditor();
			}))
			.addColorPicker(color => {
				color
				.setValue(this.plugin.settings.edgeColor)
				.onChange(async (value) => {
					this.plugin.settings.edgeColor = value;
					this.plugin.saveSettings();
					this.plugin.refreshEditor();
				})
			});
			*/

			new Setting(containerEl)
			.setName(t("THEME_VARIABLES_NAME"))
			.setDesc(t("THEME_VARIABLES_DESC"))
			.addTextArea(text => {
				const sampleConfig = {
					schemeOppsiteTheme: "dark",
					primaryColor: "#fdb05e",
					secondaryColor: "#f5f1be",
					teritaryColor: "#af71d0",
					primaryLineColor: "#3b4044",
					secondaryLineColor: "#3b4044",
					textColor: "#3b4044",
					primaryTextColor: "#3b4044",
					secondaryTextColor: "#3b4044",
					teritaryTextColor: "#3b4044",
					primaryBorderColor: "#3b4044",
					secondaryBorderColor: "#f8f8f2",
					groupBackground: "#fff",
					background1: "#f8f8f2",
					noteBackground: "#f5f1be"
				  }
				text.inputEl.classList.add('pintora-setting-textarea');
				text.inputEl.setAttribute('placeholder',JSON.stringify(sampleConfig, null, 2));
				const refresh = () => this.plugin.refreshEditor();
				text.inputEl.removeEventListener('focusout',refresh);
				text.inputEl.addEventListener('focusout',refresh);
				text
				.setValue(this.plugin.settings.themeVariables)
				.onChange(async (value) => {
					this.plugin.settings.themeVariables = value;
					await this.plugin.saveSettings();
				})
			});

	}

}


