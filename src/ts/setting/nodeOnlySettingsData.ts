
import type { SettingItem } from './types';
import { loadPlugins } from '../plugins/plugins.svelte';
import { getCurrentChat, getDatabase, loadTogglesFromChat } from '../storage/database.svelte';

export const nodeOnlySettingsItems: SettingItem[] = [
    { type: 'header', id: 'nodeonly.header', labelKey: 'nodeOnlySettings', options: { level: 'h2' }, classes: '!mb-0' },

    // Sidebar
    { id: 'nodeonly.showModelInSidebar', type: 'check', labelKey: 'showModelInSidebar', bindKey: 'showModelInSidebar', helpKey: 'showModelInSidebar', classes: 'mt-4' },
    { id: 'nodeonly.showPresetInSidebar', type: 'check', labelKey: 'showPresetInSidebar', bindKey: 'showPresetInSidebar', helpKey: 'showPresetInSidebar', classes: 'mt-4' },
    { id: 'nodeonly.showPersonaInSidebar', type: 'check', labelKey: 'showPersonaInSidebar', bindKey: 'showPersonaInSidebar', helpKey: 'showPersonaInSidebar', classes: 'mt-4' },
    { id: 'nodeonly.hideLoadout', type: 'check', labelKey: 'hideLoadout', bindKey: 'hideLoadout', helpKey: 'hideLoadout', classes: 'mt-4' },
    { id: 'nodeonly.hideEasyPanel', type: 'check', labelKey: 'hideEasyPanel', bindKey: 'hideEasyPanel', helpKey: 'hideEasyPanel', classes: 'mt-4' },
    { id: 'nodeonly.disableMobileDragDrop', type: 'check', labelKey: 'disableMobileDragDrop', bindKey: 'disableMobileDragDrop', helpKey: 'disableMobileDragDrop', classes: 'mt-4' },
    {
        id: 'nodeonly.disableToggleBinding', type: 'check', labelKey: 'disableToggleBinding', bindKey: 'disableToggleBinding',
        helpKey: 'disableToggleBinding', classes: 'mt-4',
        onChange: () => {
            if (!getDatabase().disableToggleBinding) {
                const chat = getCurrentChat();
                if (chat) loadTogglesFromChat(chat);
            }
        }
    },

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
