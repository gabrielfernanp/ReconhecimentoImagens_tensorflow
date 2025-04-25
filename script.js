// Elementos da DOM
const fileInput = document.getElementById('file-input');
const uploadArea = document.getElementById('upload-area');
const uploadBtn = document.querySelector('.upload-btn');
const webcamBtn = document.getElementById('webcam-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const loadingModel = document.getElementById('loading-model');
const canvasContainer = document.getElementById('canvas-container');
const outputCanvas = document.getElementById('output-canvas');
const webcamElement = document.getElementById('webcam');
const detectionsItems = document.getElementById('detections-items');

// Variáveis globais
let model;
let ctx;
let isWebcamActive = false;
let stream;
let animationId;
let selectedImage = null;

// Cores para as diferentes classes de objetos
const colors = [
    '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2',
    '#073B4C', '#8338EC', '#3A86FF', '#FB5607', '#FFBE0B'
];

// Inicialização
async function init() {
    ctx = outputCanvas.getContext('2d');
    
    // Carregar o modelo COCO-SSD
    try {
        model = await cocoSsd.load();
        loadingModel.style.display = 'none';
        console.log('Modelo carregado com sucesso!');
    } catch (error) {
        console.error('Erro ao carregar o modelo:', error);
        loadingModel.innerHTML = `
            <p style="color: red;">Erro ao carregar o modelo. Por favor, tente novamente.</p>
            <button class="upload-btn" onclick="location.reload()">Recarregar Página</button>
        `;
    }
}

// Função para alternar entre as abas
function setupTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover classe active de todos os botões e painéis
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Adicionar classe active ao botão clicado
            btn.classList.add('active');
            
            // Ativar o painel correspondente
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Se mudar para a aba de webcam, parar a detecção na imagem
            if (tabId === 'webcam') {
                stopImageDetection();
            } else {
                stopWebcam();
            }
        });
    });
}

// Função para configurar o upload de imagem
function setupImageUpload() {
    // Clicar na área de upload ativa o input de arquivo
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    uploadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
    
    // Arrastar e soltar
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleImageUpload(e.dataTransfer.files[0]);
        }
    });
    
    // Manipular o upload de arquivo
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleImageUpload(e.target.files[0]);
        }
    });
}

// Função para processar a imagem carregada
function handleImageUpload(file) {
    if (!file.type.match('image.*')) {
        alert('Por favor, selecione uma imagem válida.');
        return;
    }
    
    // Parar qualquer detecção anterior
    stopImageDetection();
    stopWebcam();
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        selectedImage = new Image();
        selectedImage.onload = function() {
            // Configurar o canvas para a imagem
            setupCanvasForImage(selectedImage);
            // Detectar objetos na imagem
            detectObjectsInImage(selectedImage);
        };
        selectedImage.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
}

// Configurar o canvas para a imagem
function setupCanvasForImage(img) {
    // Calcular as dimensões mantendo a proporção
    const maxWidth = canvasContainer.clientWidth;
    const scale = maxWidth / img.width;
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    
    // Definir as dimensões do canvas
    outputCanvas.width = scaledWidth;
    outputCanvas.height = scaledHeight;
    
    // Mostrar o container do canvas
    canvasContainer.style.display = 'block';
    
    // Limpar o canvas
    ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    
    // Desenhar a imagem no canvas
    ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
}

// Detectar objetos na imagem
async function detectObjectsInImage(img) {
    if (!model) {
        console.error('Modelo não carregado ainda');
        return;
    }
    
    try {
        // Mostrar indicador de carregamento
        detectionsItems.innerHTML = '<p class="no-detections">Detectando objetos...</p>';
        
        // Fazer a detecção
        const predictions = await model.detect(img);
        
        // Desenhar as detecções
        drawDetections(predictions, img.width / outputCanvas.width);
        
        // Atualizar a lista de detecções
        updateDetectionsList(predictions);
    } catch (error) {
        console.error('Erro na detecção:', error);
        detectionsItems.innerHTML = '<p class="no-detections" style="color: red;">Erro na detecção. Por favor, tente novamente.</p>';
    }
}

// Parar a detecção na imagem
function stopImageDetection() {
    selectedImage = null;
}

// Configurar a webcam
function setupWebcam() {
    webcamBtn.addEventListener('click', toggleWebcam);
}

// Alternar a webcam (ligar/desligar)
async function toggleWebcam() {
    if (isWebcamActive) {
        stopWebcam();
        webcamBtn.textContent = 'Iniciar Webcam';
    } else {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });
            
            webcamElement.srcObject = stream;
            
            // Esperar que o vídeo esteja pronto
            webcamElement.onloadedmetadata = () => {
                // Configurar o canvas para o vídeo
                setupCanvasForWebcam();
                
                // Iniciar a detecção
                isWebcamActive = true;
                webcamBtn.textContent = 'Parar Webcam';
                
                // Mostrar o container do canvas
                canvasContainer.style.display = 'block';
                
                // Iniciar o loop de detecção
                detectFrame();
            };
        } catch (error) {
            console.error('Erro ao acessar a webcam:', error);
            alert('Não foi possível acessar a webcam. Verifique as permissões do navegador.');
        }
    }
}

// Configurar o canvas para a webcam
function setupCanvasForWebcam() {
    // Definir as dimensões do canvas para corresponder ao vídeo
    outputCanvas.width = webcamElement.videoWidth;
    outputCanvas.height = webcamElement.videoHeight;
}

// Loop de detecção para a webcam
async function detectFrame() {
    if (!isWebcamActive || !model) return;
    
    try {
        // Fazer a detecção
        const predictions = await model.detect(webcamElement);
        
        // Limpar o canvas
        ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        
        // Desenhar o quadro atual do vídeo
        ctx.drawImage(webcamElement, 0, 0, outputCanvas.width, outputCanvas.height);
        
        // Desenhar as detecções
        drawDetections(predictions, 1);
        
        // Atualizar a lista de detecções
        updateDetectionsList(predictions);
        
        // Continuar o loop
        animationId = requestAnimationFrame(detectFrame);
    } catch (error) {
        console.error('Erro na detecção de vídeo:', error);
    }
}

// Parar a webcam
function stopWebcam() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        webcamElement.srcObject = null;
    }
    
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    isWebcamActive = false;
    
    // Limpar o canvas
    if (ctx) {
        ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    }
    
    // Limpar a lista de detecções
    detectionsItems.innerHTML = '<p class="no-detections">Nenhum objeto detectado ainda</p>';
}

// Desenhar as detecções no canvas
function drawDetections(predictions, scale) {
    predictions.forEach((prediction, idx) => {
        // Obter as coordenadas da caixa delimitadora
        const [x, y, width, height] = prediction.bbox;
        
        // Calcular as coordenadas escaladas
        const scaledX = x / scale;
        const scaledY = y / scale;
        const scaledWidth = width / scale;
        const scaledHeight = height / scale;
        
        // Escolher uma cor para esta classe
        const colorIdx = prediction.class.length % colors.length;
        const color = colors[colorIdx];
        
        // Desenhar a caixa delimitadora
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
        
        // Desenhar o fundo do rótulo
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(scaledX, scaledY - 30, scaledWidth, 30);
        ctx.globalAlpha = 1;
        
        // Desenhar o texto do rótulo
        ctx.fillStyle = 'white';
        ctx.font = '16px Poppins';
        ctx.fillText(
            `${prediction.class} ${Math.round(prediction.score * 100)}%`,
            scaledX + 5,
            scaledY - 10
        );
    });
}

// Atualizar a lista de detecções
function updateDetectionsList(predictions) {
    if (predictions.length === 0) {
        detectionsItems.innerHTML = '<p class="no-detections">Nenhum objeto detectado</p>';
        return;
    }
    
    let html = '';
    
    predictions.forEach((prediction, idx) => {
        const colorIdx = prediction.class.length % colors.length;
        const color = colors[colorIdx];
        
        html += `
            <div class="detection-item">
                <div class="detection-color" style="background-color: ${color}"></div>
                <span class="detection-name">${prediction.class}</span>
                <span class="detection-score">${Math.round(prediction.score * 100)}%</span>
            </div>
        `;
    });
    
    detectionsItems.innerHTML = html;
}

// Inicializar a aplicação quando a página carregar
window.addEventListener('DOMContentLoaded', () => {
    init();
    setupTabs();
    setupImageUpload();
    setupWebcam();
});

// Declare cocoSsd
const cocoSsd = window.cocoSsd;