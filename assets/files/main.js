//Initial page setup
const domain = location.href;
let emojiList;

document.addEventListener("DOMContentLoaded", async () => {
    emojiList = await getEmojis();
    swapLoading();
});

async function getEmojis() { //clean this up you lazy idiot
    const response = await fetch(`${domain}/emojis`);
    const data = await response.json();
    return data
}

async function swapLoading() {
    try {
        const response = await fetch(`${domain}/ping`, {
            method: "GET"
        });

        if (response.ok) {
            updateWindow(1);
            setupPage();
            const data = await response.json();
            for (let i = 0; i < Object.keys(data.loads).length; i++) {
                addMessage(data.loads[i]["message"], true, data.loads[i]["username"]);
            }
        } else {
            updateWindow(2);
        }
    } catch (error) {
        updateWindow(2);
    }
}

function updateWindow(id = 0) {
    let html = [
        '<div id="loadingBox"><img src="assets/images/loading.svg" class="spin" id="loadingImage"><div id="loading">Loading...</div></div>',
        '<div id="messagesBox"></div><div id="textInput"><div id="backgroundTextBox"><textarea id="inputTextBox" placeholder="Message here..." rows="1"></textarea><img src="../assets/icons/send.svg" class="button" id="sendButton"><img src="../assets/icons/file.svg" class="button" id="fileButton"></div></div>',
        '<div id="loadingBox"><img src="assets/images/loading.svg" class="failed" id="loadingImage"><div>Failed to load!</div></div>'
    ];

    document.body.innerHTML = '<div id="banner"><img src="assets/icons/settings.svg" class="button" id="settingsButton">LoChat</div><br>' + html[id];
}
//

//Page functions
let latestID = 0;
let cookies = document.cookie;
let settingsOpen = false;
let username = getCookie("username") ? getCookie("username") : "Anonymous";
let doEmbeds = getCookie("doEmbeds") ? getCookie("doEmbeds") === "true" : true;
const socket = io();

function setupPage() {
    //Resize textbox with several lines
    const inputTextBox = document.getElementById("inputTextBox");
    const backgroundTextBox = document.getElementById("backgroundTextBox");
    inputTextBox.addEventListener("input", () => {
        setHeight();
    });

    //Detect user typing and redirect them to text box
    document.addEventListener("keydown", (event) => {
        if (!settingsOpen) {
            const isTypingInput = event.target.tagName ===  "INPUT " || event.target.tagName ===  "TEXTAREA " || event.target.isContentEditable;
            if (!isTypingInput) {
                inputTextBox.focus();
        }
        }
    });

    inputTextBox.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage(inputTextBox.value);
            inputTextBox.value = "";
            setHeight();
        }
    });

    socket.on("readMessage", (data) => {
        let message = document.getElementById(data["verify"]);
        if (message) {
            if (message.innerHTML == data["message"]) {
                message.classList.remove("loading");
                return;
            }
        }
        addMessage(data["message"], true, data["username"]);
    });

    socket.on("confirmMessage", (data) => {
        let id = document.getElementById(data["id"]);
        if (id) {
            id.classList.remove("loading");
            return;
        }
    });

    const settingsButton = document.getElementById("settingsButton");
    const sendButton = document.getElementById("sendButton");
    const fileButton = document.getElementById("fileButton");

    settingsButton.addEventListener("click", () => {
        toggleSettings();
    });

    sendButton.addEventListener("click", () => {
        sendMessage(inputTextBox.value);
        inputTextBox.value = "";
        setHeight();
    });
};

function toggleSettings() {
    settingsOpen = !document.getElementById("settingsBackground");
    if (settingsOpen) {
        const div = document.createElement("div");
        div.id = "settingsBackground";
        div.innerHTML = `<div id="settingsWindow"><img src="/assets/icons/x.svg" id="closeSettings" class="button"><p>Username:</p><textarea id="usernameInput" placeholder="Username here..." rows="1">${username}</textarea><p>Embeds:</p><select id="doEmbedsSelect"><option value="true">True</option><option value="false">False</option></select>`;
        document.body.appendChild(div);

        document.getElementById("closeSettings").addEventListener("click", () => {
            toggleSettings();
        });

        const usernameInput = document.getElementById("usernameInput");
        usernameInput.addEventListener("input", () => {
            usernameInput.value = usernameInput.value.replace(/[\r\n]+/g, '').slice(0, 25);
            username = usernameInput.value;
            document.cookie = `username=${username};`
        });

        const doEmbedsSelect = document.getElementById("doEmbedsSelect");
        doEmbedsSelect.value = doEmbeds.toString();
        doEmbedsSelect.addEventListener("change", () => {
            document.cookie = `doEmbeds=${doEmbedsSelect.value};`
            doEmbeds = doEmbedsSelect.value === "true";
        });
    } else {
        document.getElementById("settingsBackground").remove();
    }
}

function setHeight() {
    inputTextBox.style.height = "auto";
    backgroundTextBox.style.height = "auto";
    let futureHeight = Math.min(Math.max(inputTextBox.scrollHeight, 0), 200)
    inputTextBox.style.height = futureHeight + "px";
    backgroundTextBox.style.height = (futureHeight + 10) + "px";
}

async function sendMessage(text) {
    if (text.trim()) {
        if (text[0] == "!") {
            runCommand(text);
            return;
        }
        addMessage(`${text}`, false, username, "mine");

        socket.emit("sendMessage", {
            username: username,
            message: text,
            verify: latestID
        });
    }
}

async function runCommand(text) {
    let command = text.slice(1, text.length);
    if (command == "ping") {
        const response = await fetch(`${domain}/ping`, {
        method: "GET"
        });

        const data = await response.text();
        addMessage(`!ping ${data}`, true);
    } else if (command == "reload") {
        updateWindow(2);
        window.open(domain, "_self");
    } else {
        const response = await fetch(`${domain}/command`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ command: command })
        });
        const data = await response.json();
        eval(data["execute"]);
    }
}

function addMessage(text, verified = false, name="", additionalTags = "") {
    const messagesBox = document.getElementById("messagesBox");

    const node = document.createElement("div");
    if ((text.includes("https://") || text.includes("http://")) && doEmbeds) {
        if (isUrl(text) && text.endsWith(".gif")) {
            text = embed(text);
        } else {
            let wordList = text.split(" ");
            let embedList = [];
            for (let i = 0; i < wordList.length; i++) {
                if (isUrl(wordList[i])) {
                    embedList.push(wordList[i]);
                    wordList[i] = `<a href="${wordList[i]}" target="_blank">${wordList[i]}</a>`;
                }
            }
            text = wordList.join(" ");
            node.innerHTML = text;
        }
    } else {
        let emojis = text.match(/:([^:\s][^:]*?):/g) || [];
        const onlyEmoji = (emojis.join(" ").length == text.length).toString();
        for (let i = 0; i < emojis.length; i++) {
            let emojiName = emojis[i].replaceAll(":", "");
            if (Object.keys(emojiList).includes(emojiName)) {
                if (!emojis[i].includes("\\:")) {
                    emojiName = (emojiList[emojiName][0] == ".") ? `<img src="assets/images/emojis/${emojiList[emojiName].slice(1)}" id="emoji" class="${onlyEmoji}">` : emojiList[emojiName];
                    text = text.replace(emojis[i], `<div id="emoji">${emojiName}<span class="tooltip">${emojiName}</span></div>`);
                } else {
                    text = text.replace(emojis[i], emojis[i].replace("\\:", ":"));
                }
            }
        }
    }
    if (name && !messagesBox.lastChild.innerHTML.includes(`me">${name}`) || name == "Anonymous") {
            node.innerHTML = `<div id="username">${name}</div>${text}`;
    } else if (node.innerHTML == "") {
        node.innerHTML = text;
    }
    node.classList = `message ${additionalTags}`;
    if (!verified) {
        node.classList.add("loading");
        latestID++;
        node.id = latestID;
    }
    messagesBox.appendChild(node);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

function isUrl(text) {
    try {
        let url = new URL(text);
    } catch (error) {
        return false;
    }
    return true;
}

function getCookie(name) { //Why are cookies so annoying?!
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

function embed(url) {
    return `<img src='${url}'>`
}
//