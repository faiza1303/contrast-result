(function (global) {
    // Objet principal pour isoler les fonctionnalités
    const contrastCouleur = {};

    const PageData = {
        // Récupère tous les éléments visibles sur la page
        allVisibleElements: Array.from(document.querySelectorAll("*")).filter(
            (el) => el.offsetParent !== null
        )
    };

    contrastCouleur.analyze = function () {
        console.log("Début de l'analyse contrastCouleur...");

        let imgCount = 0; // Compteur pour les images trouvées
        let elementsContainingTextCount = 0; // Compteur pour les éléments contenant du texte

        PageData.allVisibleElements.forEach((element) => {
            if (isImageElement(element)) {
                imgCount++;
            } else if (hasTextExcludingChildren(element) && !hasAdditionalHidingTechniques(element)) {
                const contrastCouleur_data = getContrastData(element);
                contrastTest(contrastCouleur_data);

                element.dataset.contrastCouleurData = JSON.stringify(contrastCouleur_data);
                processResult(element);
            }
        });

        console.log("Analyse terminée.");
        console.log(`Images trouvées : ${imgCount}`);
        console.log(`Éléments contenant du texte : ${elementsContainingTextCount}`);
    };

    function processResult(element) {
        const contrastCouleur_data = element.dataset.contrastCouleurData ? JSON.parse(element.dataset.contrastCouleurData) : null;

        if (!contrastCouleur_data) {
            console.warn("Aucune donnée trouvée pour cet élément :", element);
            return;
        }

        const messageContainer = document.createElement("div");
        messageContainer.style.fontSize = "12px";
        messageContainer.style.marginTop = "5px";

        if (contrastCouleur_data.result === "FAIL") {
            const minReq = contrastCouleur_data.minReq;
            const message = `
                <strong>Échec du test de contraste :</strong><br>
                <ul style="margin: 5px 0; padding-left: 15px;">
                    <li><strong>Ratio de contraste :</strong> ${contrastCouleur_data.ratio} (Minimum : ${minReq}:1)</li>
                    <li><strong>Couleur du texte :</strong> ${contrastCouleur_data.fgColor}</li>
                    <li><strong>Couleur de fond :</strong> ${contrastCouleur_data.bgColor}</li>
                </ul>`;
            messageContainer.style.color = "red";
            messageContainer.innerHTML = message;
            element.insertAdjacentElement("afterend", messageContainer);
        }
    }

    // Fonctions utilitaires
    function isImageElement(element) {
        return ["IMG", "INPUT", "SVG", "CANVAS"].includes(element.tagName);
    }

    function hasTextExcludingChildren(element) {
        return Array.from(element.childNodes).some(
            (node) =>
                node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== ""
        );
    }

    function hasAdditionalHidingTechniques(element) {
        const computedStyle = window.getComputedStyle(element);

        if (parseInt(computedStyle.fontSize) === 0) {
            return true;
        }

        const textIndent = parseInt(computedStyle.textIndent);
        if (textIndent !== 0 && textIndent < -998) {
            return true;
        }

        if (
            computedStyle.overflow === "hidden" &&
            (parseInt(computedStyle.height) <= 1 || parseInt(computedStyle.width) <= 1)
        ) {
            return true;
        }

        return false;
    }

    // Fonction pour effectuer le test de contraste
    function contrastTest(contrastCouleur_data) {
        const ratio_small = 4.5; // Texte normal
        const ratio_large = 3.0; // Texte large ou gras

        contrastCouleur_data.minReq = ratio_small;
        if (contrastCouleur_data.size >= 24) {
            contrastCouleur_data.minReq = ratio_large;
        } else if (contrastCouleur_data.size >= 18.66 && contrastCouleur_data.weight >= 700) {
            contrastCouleur_data.minReq = ratio_large;
        }

        if (contrastCouleur_data.bgImage === "none" && !contrastCouleur_data.opacity) {
            contrastCouleur_data.result =
                contrastCouleur_data.ratio >= contrastCouleur_data.minReq ? "PASS" : "FAIL";
        }
    }

    // Fonction pour récupérer les données de contraste d'un élément
    function getContrastData(element) {
        const computedStyle = window.getComputedStyle(element);

        let bgColor = computedStyle.backgroundColor;
        let fgColor = computedStyle.color;

        if (bgColor === "rgba(0, 0, 0, 0)" || bgColor === "transparent") {
            bgColor = getBackgroundFromParent(element);
        }

        const fgParsed = new Color(fgColor);
        const bgParsed = new Color(bgColor);
        if (fgParsed.alpha < 1) {
            fgColor = fgParsed.overlayOnTest(bgParsed);
        }

        const ratio = calculateContrastRatio(fgColor, bgColor);

        return {
            bgColor,
            fgColor,
            ratio,
            size: parseFloat(computedStyle.fontSize),
            weight: parseInt(computedStyle.fontWeight, 10),
            bgImage: computedStyle.backgroundImage,
            opacity: parseFloat(computedStyle.opacity) < 1
        };
    }

    // Fonction pour gérer les arrière-plans hérités
    function getBackgroundFromParent(element) {
        let parent = element.parentElement;
        while (parent) {
            const parentStyle = window.getComputedStyle(parent);
            const bgColor = parentStyle.backgroundColor;

            if (bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent") {
                return bgColor;
            }
            parent = parent.parentElement;
        }
        return "rgb(255, 255, 255)";
    }

    // Classe pour gérer les couleurs
    class Color {
        constructor(colorString) {
            const match = colorString.match(/rgba?\((\d+), (\d+), (\d+)(?:, (\d+(\.\d+)?))?\)/);
            this.r = parseInt(match[1], 10);
            this.g = parseInt(match[2], 10);
            this.b = parseInt(match[3], 10);
            this.alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
        }

        overlayOnTest(bgColor) {
            const r = Math.round(this.alpha * this.r + (1 - this.alpha) * bgColor.r);
            const g = Math.round(this.alpha * this.g + (1 - this.alpha) * bgColor.g);
            const b = Math.round(this.alpha * this.b + (1 - this.alpha) * bgColor.b);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    // Calcule le ratio de contraste
    function calculateContrastRatio(fgColor, bgColor) {
        const fgLuminance = calculateLuminance(fgColor);
        const bgLuminance = calculateLuminance(bgColor);

        return (
            (Math.max(fgLuminance, bgLuminance) + 0.05) /
            (Math.min(fgLuminance, bgLuminance) + 0.05)
        ).toFixed(2);
    }

    // Calcule la luminance pour une couleur donnée
    function calculateLuminance(color) {
        const rgb = color
            .match(/\d+/g)
            .map((value) => parseInt(value, 10) / 255)
            .map((channel) =>
                channel <= 0.03928
                    ? channel / 12.92
                    : Math.pow((channel + 0.055) / 1.055, 2.4)
            );

        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    }

    // Fonction principale pour démarrer l'analyse
    contrastCouleur.launchAnalysis = function () {
        console.log("Lancement de l'analyse contrastCouleur...");
        contrastCouleur.analyze();
        console.log("Analyse terminée.");
    };

    // Expose l'objet contrastCouleur dans le contexte global
    global.contrastCouleur = contrastCouleur;

    console.log("Script contrastCouleur prêt. Utilisez 'contrastCouleur.launchAnalysis()' pour démarrer l'analyse.");
})(window);
