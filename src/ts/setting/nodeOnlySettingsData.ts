
import type { SettingItem } from './types';
import { loadPlugins } from '../plugins/plugins.svelte';

export const nodeOnlySettingsItems: SettingItem[] = [
    { type: 'header', id: 'nodeonly.header', labelKey: 'nodeOnlySettings', options: { level: 'h2' }, classes: '!mb-0' },

    // Sidebar
    { id: 'nodeonly.showModelInSidebar', type: 'check', labelKey: 'showModelInSidebar', bindKey: 'showModelInSidebar', classes: 'mt-4' },
    { id: 'nodeonly.showPresetInSidebar', type: 'check', labelKey: 'showPresetInSidebar', bindKey: 'showPresetInSidebar', classes: 'mt-4' },
    { id: 'nodeonly.showPersonaInSidebar', type: 'check', labelKey: 'showPersonaInSidebar', bindKey: 'showPersonaInSidebar', classes: 'mt-4' },
    { id: 'nodeonly.disableMobileDragDrop', type: 'check', labelKey: 'disableMobileDragDrop', bindKey: 'disableMobileDragDrop', classes: 'mt-4' },

    // Inlay Image
    { id: 'nodeonly.inlayLossless', type: 'check', labelKey: 'inlayImageLossless', bindKey: 'inlayImageLossless', helpKey: 'inlayImageLossless', classes: 'mt-4' },
    { id: 'nodeonly.inlayImagePriority', type: 'check', labelKey: 'inlayImagePriority', bindKey: 'inlayImagePriority', helpKey: 'inlayImagePriority', classes: 'mt-4' },
    { id: 'nodeonly.inlayCompress', type: 'custom', componentId: 'InlayCompressButton' },

    // Plugin
    {
        id: 'nodeonly.allowV2Plugin', type: 'check', labelKey: 'allowV2Plugin', bindKey: 'allowV2Plugin',
        helpKey: 'allowV2Plugin', helpUnrecommended: true, classes: 'mt-4',
        onChange: () => {
            void loadPlugins();
        }
    },
];
