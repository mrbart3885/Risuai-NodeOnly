import { globalFetch } from "./globalApi.svelte";

let bgmElement:HTMLAudioElement|null = null;
let domObserver: MutationObserver | null = null;

const OBSERVED_HL_ATTR = 'data-risu-observed-hl'
const OBSERVED_CTRL_ATTR = 'data-risu-observed-ctrl'

function nodeObserve(node:HTMLElement){
    const hlLang = node.getAttribute('x-hl-lang');
    const ctrlName = node.getAttribute('risu-ctrl');

    if(hlLang && node.getAttribute(OBSERVED_HL_ATTR) !== '1'){
        node.setAttribute(OBSERVED_HL_ATTR, '1')
        node.addEventListener('contextmenu', (e)=>{
            e.preventDefault()

            const prevContextMenu = document.getElementById('code-contextmenu')
            if(prevContextMenu){
                prevContextMenu.remove()
            }

            const menu = document.createElement('div')
            menu.id = 'code-contextmenu'
            menu.setAttribute('class', 'fixed z-50 min-w-[160px] py-2 bg-gray-800 rounded-lg border border-gray-700')

            const copyOption = document.createElement('div')
            copyOption.textContent = 'Copy'
            copyOption.setAttribute('class', 'px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer')
            copyOption.addEventListener('click', ()=>{
                navigator.clipboard.writeText(node.textContent ?? '')
                menu.remove()
            })

            const downloadOption = document.createElement('div');
            downloadOption.textContent = 'Download';
            downloadOption.setAttribute('class', 'px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer')
            downloadOption.addEventListener('click', ()=>{
                const a = document.createElement('a')
                a.href = URL.createObjectURL(new Blob([node.textContent ?? ''], {type: 'text/plain'}))
                a.download = 'code.' + hlLang
                a.click()
                menu.remove()
            })

            menu.appendChild(copyOption)
            menu.appendChild(downloadOption)

            menu.style.left = e.clientX + 'px'
            menu.style.top = e.clientY + 'px'

            document.body.appendChild(menu)

            document.addEventListener('click', ()=>{
                menu?.remove()
            }, {once: true})
        })
    }

    if(ctrlName && node.getAttribute(OBSERVED_CTRL_ATTR) !== '1'){
        node.setAttribute(OBSERVED_CTRL_ATTR, '1')
        const split = ctrlName.split('___');

        switch(split[0]){
            case 'bgm':{
                const volume = split[1] === 'auto' ? 0.5 : parseFloat(split[1]);
                if(!bgmElement){
                    bgmElement = new Audio(split[2]);
                    bgmElement.volume = volume
                    bgmElement.addEventListener('ended', ()=>{
                        bgmElement.remove();
                        bgmElement = null;
                    })
                    bgmElement.play();
                }
                break
            }
        }
    }
}

function observeNodeTree(node: Node) {
    if(!(node instanceof Element)){
        return
    }

    if(node instanceof HTMLElement){
        nodeObserve(node)
    }

    node.querySelectorAll<HTMLElement>('[x-hl-lang], [risu-ctrl]').forEach((element) => {
        nodeObserve(element)
    })
}

export async function startObserveDom(){
    if(domObserver){
        return
    }

    // For parsed HTML blocks, scan once and then watch future subtree insertions.
    document.querySelectorAll<HTMLElement>('[x-hl-lang], [risu-ctrl]').forEach((node) => {
        nodeObserve(node)
    })

    const target = document.body ?? document.documentElement
    if(!target){
        return
    }

    domObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if(mutation.type === 'attributes'){
                if(mutation.target instanceof HTMLElement){
                    nodeObserve(mutation.target)
                }
                return
            }
            mutation.addedNodes.forEach((node) => {
                observeNodeTree(node)
            })
        })
    })
    domObserver.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['x-hl-lang', 'risu-ctrl'],
    })
}


let claudeObserverRunning = false;
let claudeObserverTimer: ReturnType<typeof setInterval> | null = null;
let lastClaudeObserverLoad = 0;
let lastClaudeRequestTimes = 0;
let lastClaudeObserverPayload:any = null;
let lastClaudeObserverHeaders:any = null;
let lastClaudeObserverURL:any = null;

function stopClaudeObserver(){
    if(claudeObserverTimer){
        clearInterval(claudeObserverTimer)
        claudeObserverTimer = null
    }
    claudeObserverRunning = false
}

export function registerClaudeObserver(arg:{
    url:string,
    body:any,
    headers:any,
}) {
    lastClaudeRequestTimes = 0;
    lastClaudeObserverLoad = Date.now();
    lastClaudeObserverPayload = safeStructuredClone(arg.body)
    lastClaudeObserverHeaders = arg.headers;
    lastClaudeObserverURL = arg.url;
    lastClaudeObserverPayload.max_tokens = 10;
    claudeObserver()
}

function claudeObserver(){
    if(claudeObserverRunning){
        return
    }
    claudeObserverRunning = true;

    const fetchIt = async (tries = 0)=>{
        const res = await globalFetch(lastClaudeObserverURL, {
            body: lastClaudeObserverPayload,
            headers: lastClaudeObserverHeaders,
            method: "POST"
        })
        if(res.status >= 400){
            if(tries < 3){
                return fetchIt(tries + 1)
            }
        }
    }

    const func = ()=>{
        //request every 4 minutes and 30 seconds
        if(lastClaudeObserverLoad > Date.now() - 1000 * 60 * 4.5){
            return
        }

        if(lastClaudeRequestTimes > 4){
            stopClaudeObserver()
            return
        }
        void fetchIt()
        lastClaudeObserverLoad = Date.now();
        lastClaudeRequestTimes += 1;

        if(lastClaudeRequestTimes > 4){
            stopClaudeObserver()
        }
    }

    claudeObserverTimer = setInterval(func, 20000)
}