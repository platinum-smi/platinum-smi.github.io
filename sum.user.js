// ==UserScript==
// @name         Подсчет объявлений за день
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Подсчет объявлений за день
// @match        https://djoniohanter.com/smi.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    window.addEventListener('load', () => {
        const headers = Array.from(document.querySelectorAll("h2"));
        if (!headers.length) return;

        const targetHeader = headers.find(h =>
            /ТОП РАДИОЦЕНТРА (ЛС|СФ|ЛВ) ПО КОЛ-ВУ ОБЪЯВЛЕНИЙ ЗА ДЕНЬ/i.test(h.innerText.trim())
        );

        if (!targetHeader) return;

        const container = targetHeader.parentElement;
        const text = container.innerText;

        const regex = /Количество объявлений:\s*(\d+)/g;

        let match;
        let total = 0;

        while ((match = regex.exec(text)) !== null) {
            total += Number(match[1]);
        }

        const out = document.createElement("div");
        out.style.marginTop = "12px";
        out.style.fontSize = "18px";
        out.style.fontWeight = "bold";
        out.style.color = "#656360";
        out.textContent = `Всего объявлений за день: ${total}`;

        targetHeader.insertAdjacentElement("afterend", out);
    });
})();
