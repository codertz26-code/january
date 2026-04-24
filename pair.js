const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const zlib = require('zlib');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    Browsers, 
    makeCacheableSignalKeyStore 
} = require('@whiskeysockets/baileys');
const { sendButtons } = require('gifted-btns');
const { upload } = require('./mega');

// === CONFIGURATION ===
const SESSION_PREFIX = "SILA-MD~";
const BOT_REPO = "https://github.com/Sila-Md/SILA-MD";
const WA_CHANNEL = "https://whatsapp.com/channel/0029VbBG4gfISTkCpKxyMH02";
const THUMBNAIL_URL = "https://files.catbox.moe/98k75b.jpeg";

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

// Function to generate long session string
function generateLongSession(credsPath) {
    try {
        const credsData = fs.readFileSync(credsPath, 'utf8');
        const compressedData = zlib.gzipSync(credsData);
        const b64data = compressedData.toString('base64');
        return SESSION_PREFIX + b64data;
    } catch (error) {
        console.error("Error generating long session:", error);
        return null;
    }
}

// Function to upload creds.json and return session code
async function generateCredsSession(credsPath, sockUserJid) {
    try {
        const mega_url = await upload(fs.createReadStream(credsPath), `${sockUserJid}.json`);
        const string_session = mega_url.replace('https://mega.nz/file/', '');
        return "sila~" + string_session;
    } catch (error) {
        console.error("Error uploading creds:", error);
        return null;
    }
}

// Function to format the session message
function formatSessionMessage(sessionCode, sessionType) {
    let typeLabel = sessionType === 'long' ? 'LONG SESSION' : 'CREDS SESSION';
    
    return `┏━❑ *SILA-MD ${typeLabel}* ✅
┏━❑ *SAFETY RULES* ━━━━━━━━━
┃ 🔹 *Session ID:* Sent above.
┃ 🔹 *Warning:* Do not share this code!
┃ 🔹 Keep this code safe.
┃ 🔹 Valid for 24 hours only.
┗━━━━━━━━━━━━━━━
┏━❑ *CHANNEL* ━━━━━━━━━
┃ 📢 Follow our channel: ${WA_CHANNEL}
┗━━━━━━━━━━━━━━━
┏━❑ *REPOSITORY* ━━━━━━━━━
┃ 💻 Repository: ${BOT_REPO}
┃ 👉 Fork & contribute!
┗━━━━━━━━━━━━━━━

> © 𝐏𝐨𝐰𝐞𝐫𝐞𝐝 𝐁𝐲 𝐒𝐢𝐥𝐚 𝐓𝐞𝐜𝐡`;
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;
    const sessionType = req.query.session || 'long'; // Default to 'long' session

    async function SILA_MD_PAIR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        
        try {
            const items = ["Safari", "Chrome", "Firefox"];
            const randomItem = items[Math.floor(Math.random() * items.length)];
            
            let sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                generateHighQualityLinkPreview: true,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                syncFullHistory: false,
                browser: Browsers.macOS(randomItem)
            });
            
            if (!sock.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                if (!res.headersSent) await res.send({ code });
            }
            
            sock.ev.on('creds.update', saveCreds);
            
            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection == "open") {
                    await delay(3000);
                    let rf = __dirname + `/temp/${id}/creds.json`;

                    try {
                        let sessionCode;
                        
                        if (sessionType === 'long') {
                            // Generate long session string
                            sessionCode = generateLongSession(rf);
                            if (!sessionCode) throw new Error("Failed to generate long session");
                        } else {
                            // Upload creds.json and get session code
                            sessionCode = await generateCredsSession(rf, sock.user.id);
                            if (!sessionCode) throw new Error("Failed to upload creds");
                        }

                        // Send session code first
                        let codeMsg = await sock.sendMessage(sock.user.id, { 
                            text: `*📱 YOUR ${sessionType.toUpperCase()} SESSION CODE*\n\n${sessionCode}`
                        });

                        // Prepare button options
                        const msgButtons = [
                            { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: '📋 Copy Session', copy_code: sessionCode }) },
                            { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '📂 Bot Repository', url: BOT_REPO }) },
                            { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: '📢 Join Channel', url: WA_CHANNEL }) }
                        ];

                        // Send formatted message with buttons
                        let desc = formatSessionMessage(sessionCode, sessionType);
                        
                        await sock.sendMessage(sock.user.id, {
                            text: desc,
                            contextInfo: {
                                externalAdReply: {
                                    title: 'SILA MD',
                                    body: `© Sila Tech - ${sessionType.toUpperCase()} SESSION`,
                                    thumbnailUrl: THUMBNAIL_URL,
                                    thumbnailWidth: 64,
                                    thumbnailHeight: 64,
                                    sourceUrl: WA_CHANNEL,
                                    mediaUrl: THUMBNAIL_URL,
                                    showAdAttribution: true,
                                    renderLargerThumbnail: false,
                                    previewType: 'PHOTO',
                                    mediaType: 1
                                },
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: '120363402325089913@newsletter',
                                    newsletterName: '© Sila Tech',
                                    serverMessageId: Math.floor(Math.random() * 1000000)
                                },
                                isForwarded: true,
                                forwardingScore: 999
                            }
                        }, { quoted: codeMsg });

                        // Send interactive buttons
                        await sendButtons(sock, sock.user.id, {
                            title: 'SILA MD Session',
                            description: `Your ${sessionType.toUpperCase()} session has been generated.\n\n⚠️ Please keep it safe and do not share with anyone!`,
                            buttons: msgButtons,
                            footer: '© Sila Tech'
                        });

                    } catch (e) {
                        console.error("Session generation error:", e);
                        
                        let errorMsg = await sock.sendMessage(sock.user.id, { 
                            text: `*⚠️ Session Generation Error*\n\n${e.message || e.toString()}\n\nPlease try again with a different session type.`
                        });
                        
                        let desc = formatSessionMessage("ERROR" + sessionCode || "", sessionType)
                            .replace("✅", "⚠️")
                            .replace("Sent above.", "Error occurred. Please try again.");
                        
                        await sock.sendMessage(sock.user.id, {
                            text: desc,
                            contextInfo: {
                                externalAdReply: {
                                    title: 'SILA MD',
                                    body: '© Sila Tech',
                                    thumbnailUrl: THUMBNAIL_URL,
                                    thumbnailWidth: 64,
                                    thumbnailHeight: 64,
                                    sourceUrl: WA_CHANNEL,
                                    mediaUrl: THUMBNAIL_URL,
                                    showAdAttribution: true,
                                    renderLargerThumbnail: false,
                                    previewType: 'PHOTO',
                                    mediaType: 1
                                },
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: '120363402325089913@newsletter',
                                    newsletterName: '© Sila Tech',
                                    serverMessageId: Math.floor(Math.random() * 1000000)
                                },
                                isForwarded: true,
                                forwardingScore: 999
                            }
                        }, { quoted: errorMsg });
                    }

                    await delay(10);
                    await sock.ws.close();
                    await removeFile('./temp/' + id);
                    console.log(`👤 ${sock.user.id} 🔥 SILA-MD Session Connected (${sessionType.toUpperCase()}) ✅`);
                    await delay(10);
                    process.exit();

                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10);
                    SILA_MD_PAIR_CODE();
                }
            });
            
        } catch (err) {
            console.log("⚠️ SILA-MD Connection failed — Restarting service...");
            await removeFile('./temp/' + id);
            if (!res.headersSent) await res.send({ code: "❗ SILA-MD Service Unavailable" });
        }
    }

    return await SILA_MD_PAIR_CODE();
});

module.exports = router;
