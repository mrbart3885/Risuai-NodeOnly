import { getDatabase } from "./database.svelte";
import { downloadFile } from "../globalApi.svelte";
import { notifySuccess } from "../alert";
import { language } from "src/lang";

export async function exportAsDataset(){
    const db = getDatabase()

    let dataset = []
    for(const char of db.characters){
        for(const chat of char.chats){
            
            dataset.push({
                name: char.name,
                description: char.desc,
                chats: chat.message,
                lorebook: char.globalLore
            })
        }
    }

    await downloadFile('dataset.json',Buffer.from(JSON.stringify(dataset, null,4), 'utf-8'))

    notifySuccess(language.successExport)
    
}
