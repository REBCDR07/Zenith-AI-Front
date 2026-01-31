document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? ''
        : 'https://Shads229-Zenith-AI.hf.space';

    // Configuration de marked pour un rendu plus naturel
    marked.setOptions({
        breaks: true,
        gfm: true
    });

    // Éléments UI
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const urlInput = document.getElementById('url-input');
    const urlSubmit = document.getElementById('url-submit');

    const promptCard = document.getElementById('prompt-card');
    const customPrompt = document.getElementById('custom-prompt');
    const sendPromptBtn = document.getElementById('send-prompt-btn');

    const resultPanel = document.getElementById('result-panel');
    const reportOutput = document.getElementById('report-output');
    const streamingProgress = document.getElementById('streaming-progress');
    const downloadBtn = document.getElementById('download-report');
    const copyBtn = document.getElementById('copy-report');
    const resetAppBtn = document.getElementById('reset-app');

    const importStatus = document.getElementById('import-status-container');
    const importStatusText = document.getElementById('import-status-text');
    const uploadProgressBar = document.getElementById('upload-progress-bar');
    const appStatusBadge = document.getElementById('app-status');

    const videoPreviewContainer = document.getElementById('video-preview-container');
    const previewPlayer = document.getElementById('preview-player');
    const importCard = document.querySelector('.import-card');

    let currentSessionId = null;
    let currentVideoPath = null;
    let fullReport = "";

    // --- GESTION DES ÉTAPES ---
    function setActiveCard(activeCard) {
        document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
        if (activeCard) activeCard.classList.add('active');
    }

    setActiveCard(importCard);

    // --- INTERACTION PROMPT ---
    customPrompt.addEventListener('input', () => {
        promptCard.classList.remove('pulse-active');
    });

    customPrompt.addEventListener('focus', () => {
        promptCard.classList.remove('pulse-active');
    });

    // --- HELPERS ---
    const safeAddEventListener = (el, type, handler) => {
        if (el) el.addEventListener(type, handler);
    };

    // --- CHECK-UP INITIAL ---
    async function checkBackendStatus() {
        if (!appStatusBadge) return;
        try {
            const resp = await fetch(`${API_BASE_URL}/`);
            const data = await resp.json();

            if (data.diagnostics && data.diagnostics.gcp_service_account === "NON") {
                appStatusBadge.innerText = "IA non configurée";
                appStatusBadge.style.background = "rgba(239, 68, 68, 0.1)";
                appStatusBadge.style.color = "#ef4444";
            } else {
                appStatusBadge.innerText = "Système opérationnel";
            }
        } catch (err) {
            appStatusBadge.innerText = "Backend hors ligne";
            appStatusBadge.style.background = "rgba(239, 68, 68, 0.1)";
            appStatusBadge.style.color = "#ef4444";
        }
    }
    checkBackendStatus();

    // --- GESTION DES ONGLETS ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('bg-slate-800', 'text-white');
                b.classList.add('text-slate-400');
            });
            tabContents.forEach(c => c.classList.add('hidden'));

            btn.classList.add('bg-slate-800', 'text-white');
            btn.classList.remove('text-slate-400');

            const target = document.getElementById(`${btn.dataset.tab}-tab`);
            if (target) target.classList.remove('hidden');
        });
    });

    // --- IMPORTATION ---
    // Note: Le input est dans le label, donc le clic sur le label déclenche déjà l'input.
    // dropZone.addEventListener('click', () => fileInput.click());

    // Effet visuel Drag & Drop
    if (dropZone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('border-accent', 'bg-accent/5');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = e.dataTransfer.files;
            if (files.length > 0) handleFileUpload(files[0]);
        });
    }

    safeAddEventListener(fileInput, 'change', (e) => {
        if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
    });

    async function handleFileUpload(file) {
        showStatus(importStatus, importStatusText, "Téléchargement : 0%");
        const formData = new FormData();
        formData.append('file', file);

        try {
            const data = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${API_BASE_URL}/analyze/upload`, true);

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        importStatusText.innerText = `Téléchargement : ${percent}%`;
                        if (uploadProgressBar) uploadProgressBar.style.width = `${percent}%`;
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                };

                xhr.onerror = () => reject(new Error('Network error during upload'));
                xhr.send(formData);
            });

            onImportSuccess(data);
        } catch (err) {
            console.error(err);
            showStatus(importStatus, importStatusText, "Erreur de transfert", true);
        }
    }

    safeAddEventListener(urlSubmit, 'click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        showStatus(importStatus, importStatusText, "Récupération du média...");
        const formData = new FormData();
        formData.append('url', url);

        try {
            const resp = await fetch(`${API_BASE_URL}/analyze/url`, { method: 'POST', body: formData });
            const data = await resp.json();
            onImportSuccess(data);
        } catch (err) {
            showStatus(importStatus, importStatusText, "Lien invalide ou erreur", true);
        }
    });

    safeAddEventListener(urlInput, 'keydown', (e) => {
        if (e.key === 'Enter') urlSubmit.click();
    });

    function onImportSuccess(data) {
        currentSessionId = data.session_id;
        currentVideoPath = data.video_path;
        showStatus(importStatus, importStatusText, "Média importé avec succès", false);

        // Afficher l'aperçu vidéo
        if (data.video_url) {
            if (previewPlayer) previewPlayer.src = `${API_BASE_URL}${data.video_url}`;
            if (videoPreviewContainer) videoPreviewContainer.classList.remove('hidden');
        }

        // Réinitialiser les panels
        if (resultPanel) resultPanel.classList.add('hidden');

        // On passe directement à l'étape du Prompt
        // L'extraction se fait en arrière-plan côté serveur (déjà incluse dans la réponse data.frames)
        if (promptCard) {
            promptCard.classList.remove('opacity-40', 'grayscale', 'pointer-events-none');
            promptCard.classList.add('pulse-active');
        }
        if (sendPromptBtn) sendPromptBtn.disabled = false;
        setActiveCard(promptCard);

        // Scroll fluide vers le prompt
        setTimeout(() => {
            if (customPrompt) customPrompt.focus();
            if (promptCard) promptCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 600);
    }

    // --- ÉTAPE 2 : GÉNÉRATION DU RAPPORT (SSE) ---
    let currentEventSource = null;

    safeAddEventListener(sendPromptBtn, 'click', () => {
        const promptText = customPrompt.value.trim();
        if (!promptText) return;

        // Si une analyse est déjà en cours, on la ferme
        if (currentEventSource) {
            currentEventSource.close();
        }

        if (sendPromptBtn) sendPromptBtn.disabled = true;
        if (sendPromptBtn) sendPromptBtn.innerText = "GÉNÉRATION EN COURS...";

        if (resultPanel) resultPanel.classList.remove('hidden');
        const card = resultPanel ? resultPanel.querySelector('.card') : null;
        if (card) setActiveCard(card);
        if (reportOutput) reportOutput.innerHTML = '<div class="typing">L\'IA analyse les données visuelles et audio...</div>';
        if (streamingProgress) streamingProgress.style.width = '0%';

        // Scroll vers le panel de résultat
        if (resultPanel) {
            setTimeout(() => {
                resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }

        fullReport = "";
        const encodedPrompt = encodeURIComponent(promptText);
        const url = `${API_BASE_URL}/stream/${currentSessionId}?video_path=${encodeURIComponent(currentVideoPath)}&prompt=${encodedPrompt}`;

        currentEventSource = new EventSource(url);
        let progress = 0;

        currentEventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.status === 'streaming') {
                fullReport += data.text;
                if (reportOutput) reportOutput.innerHTML = marked.parse(fullReport);

                // Simulation de progression fluide
                progress = Math.min(progress + 0.5, 95);
                if (streamingProgress) streamingProgress.style.width = `${progress}%`;

                // Auto-scroll intelligent
                const threshold = 150;
                const isNearBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - threshold);
                if (isNearBottom) {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }
            } else if (data.message) {
                const typingElem = reportOutput ? reportOutput.querySelector('.typing') : null;
                if (typingElem) typingElem.innerText = `IA : ${data.message}`;
            }

            if (data.status === 'completed') {
                currentEventSource.close();
                currentEventSource = null;
                if (streamingProgress) streamingProgress.style.width = '100%';
                if (sendPromptBtn) sendPromptBtn.disabled = false;
                if (sendPromptBtn) sendPromptBtn.innerText = "RÉ-ANALYSER AVEC CE PROMPT";
            }

            if (data.error) {
                currentEventSource.close();
                currentEventSource = null;
                if (streamingProgress) streamingProgress.style.width = '0%';
                if (reportOutput) reportOutput.innerHTML = `<div class="error-msg" style="color:#ef4444; padding:20px; border:1px solid #ef4444; border-radius:12px; background:rgba(239,68,68,0.1)">Erreur IA: ${data.error}</div>`;
                if (sendPromptBtn) sendPromptBtn.disabled = false;
                if (sendPromptBtn) sendPromptBtn.innerText = "RÉESSAYER";
            }
        };

        currentEventSource.onerror = () => {
            if (currentEventSource) {
                currentEventSource.close();
                currentEventSource = null;
            }
            if (sendPromptBtn) sendPromptBtn.disabled = false;
            if (sendPromptBtn) sendPromptBtn.innerText = "ERREUR - RÉESSAYER";
        };
    });

    // --- ACTIONS FINALES ---
    safeAddEventListener(resetAppBtn, 'click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => location.reload(), 500);
    });

    safeAddEventListener(copyBtn, 'click', () => {
        if (!reportOutput) return;
        navigator.clipboard.writeText(reportOutput.innerText).then(() => {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerText = "Copié !";
            copyBtn.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
            copyBtn.style.borderColor = "var(--success)";
            copyBtn.style.color = "var(--success)";

            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.style.backgroundColor = "";
                copyBtn.style.borderColor = "";
                copyBtn.style.color = "";
            }, 2000);
        });
    });

    safeAddEventListener(downloadBtn, 'click', () => {
        const originalText = downloadBtn.innerText;
        if (downloadBtn) downloadBtn.innerText = "GÉNÉRATION...";

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Inter', -apple-system, sans-serif; padding: 40px; line-height: 1.6; max-width: 850px; margin: auto; color: #1e293b; background: #f8fafc; }
                    h1 { color: #0f172a; font-weight: 800; border-bottom: 4px solid #8b5cf6; padding-bottom: 10px; display: inline-block; }
                    h2 { color: #8b5cf6; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 32px; }
                    strong { color: #000; background: #ede9fe; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
                    pre { background: #1e293b; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; }
                    code { font-family: monospace; font-size: 0.9em; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
                    th { background: #f1f5f9; }
                    blockquote { border-left: 4px solid #8b5cf6; padding-left: 20px; color: #475569; font-style: italic; margin: 20px 0; }
                </style>
            </head>
            <body>
                <h1>Rapport Zenith AI</h1>
                <p style="color: #64748b; font-size: 0.9em;">Analyse générée le ${new Date().toLocaleString()}</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                ${marked.parse(fullReport)}
            </body>
            </html>
        `;
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Zenith_Analysis_${Date.now()}.html`;
        a.click();

        setTimeout(() => {
            if (downloadBtn) downloadBtn.innerText = originalText;
        }, 1500);
    });

    // --- UTILITAIRES ---
    function showStatus(container, textElem, message, isError = false) {
        if (!container || !textElem) return;
        container.classList.remove('hidden');
        textElem.innerText = message;
        const spinner = container.querySelector('.spinner-mini');

        if (isError) {
            container.style.borderLeftColor = "#ef4444";
            container.style.background = "rgba(239, 68, 68, 0.05)";
            if (spinner) spinner.style.display = "none";
        } else if (message.includes("succès") || message.includes("prêt")) {
            container.style.borderLeftColor = "#10b981";
            container.style.background = "rgba(16, 185, 129, 0.05)";
            if (spinner) spinner.style.display = "none";
        } else {
            container.style.borderLeftColor = "var(--accent)";
            container.style.background = "rgba(139, 92, 246, 0.05)";
            if (spinner) spinner.style.display = "block";
        }
    }
});
