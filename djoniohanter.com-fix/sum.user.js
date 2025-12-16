// ==UserScript==
// @name         Подсчет объявлений djoniohanter.com/smi
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Подсчет объявлений по дням и диапазонам
// @author       q0wqex
// @match        https://djoniohanter.com/smi.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Конфигурационный объект
    const CONFIG = {
        dateRegex: /Количество объявлений:\s*(\d+)/g,
        headerRegex: /ТОП РАДИОЦЕНТРА (ЛС|СФ|ЛВ) ПО КОЛ-ВУ ОБЪЯВЛЕНИЙ ЗА ДЕНЬ/i,
        buttonStyles: {
            padding: '12px 20px',
            border: 'none',
            backgroundColor: '#3F51B5',
            color: '#ffffff',
            fontWeight: '500',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background 0.3s, transform 0.2s',
            margin: '5px',
            flex: '1'
        },
        hoverColor: '#2c387e',
        normalColor: '#3F51B5'
    };

    // Вспомогательные функции
    const utils = {
        // Форматирование числа с ведущим нулем
        padNumber: (num, size) => num.toString().padStart(size, '0'),
        
        // Создание элемента с атрибутами и стилями
        createElement: (tag, options = {}) => {
            const element = document.createElement(tag);
            if (options.attrs) {
                Object.entries(options.attrs).forEach(([key, value]) => {
                    element.setAttribute(key, value);
                });
            }
            if (options.styles) {
                Object.entries(options.styles).forEach(([key, value]) => {
                    element.style[key] = value;
                });
            }
            if (options.content) {
                element.textContent = options.content;
            }
            return element;
        },
        
        // Клонирование поля с очисткой ID и применением стилей
        cloneField: (field, customId = null) => {
            const clone = field.cloneNode(true);
            clone.removeAttribute('id');
            if (customId) {
                clone.setAttribute('id', customId);
            }
            if (field.style.cssText) {
                clone.style.cssText = field.style.cssText;
            }
            return clone;
        },
        
        // Проверка валидности даты
        isValidDate: (dateStr) => {
            const date = new Date(dateStr);
            return !isNaN(date.getTime());
        },
        
        // Подсчет суммы из текста по регулярному выражению
        calculateTotal: (text, regex) => {
            let total = 0;
            let match;
            while ((match = regex.exec(text)) !== null) {
                total += Number(match[1]);
            }
            return total;
        }
    };

    // Функция для получения количества объявлений за конкретный день
    async function getDayCount(day, month, year, obki = 8) {
        try {
            const payload = new URLSearchParams({
                search_platinum: "",
                day: utils.padNumber(day, 2),
                month: utils.padNumber(month, 2),
                year: year.toString(),
                obki_wr: obki.toString()
            });

            const response = await fetch("https://djoniohanter.com/smi.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: payload.toString()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();

            // Парсим HTML в виртуальный DOM
            const doc = new DOMParser().parseFromString(html, "text/html");

            // Ищем все строки "Количество объявлений: N"
            const text = doc.body.innerText;
            
            return utils.calculateTotal(text, new RegExp(CONFIG.dateRegex.source, 'g'));
        } catch (error) {
            console.error(`Ошибка при получении количества объявлений за ${day}.${month}.${year}:`, error);
            throw error;
        }
    }

    // Функция для подсчета объявлений в диапазоне дат
    async function countRange(from, to, obki = 8) {
        try {
            // Преобразуем строки дат в объекты Date
            const startDate = new Date(from);
            const endDate = new Date(to);
            
            // Устанавливаем время на начало дня для корректного сравнения
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);

            let current = startDate;
            let totalAll = 0;
            
            // Массивы для хранения промисов и дат для логирования
            const dailyCountsPromises = [];
            const datesForLogging = [];

            while (current <= endDate) {
                const d = current.getDate();
                const m = current.getMonth() + 1;
                const y = current.getFullYear();

                // Сохраняем дату для последующего логирования
                datesForLogging.push({ d, m, y });

                // Добавляем промис в массив
                dailyCountsPromises.push(getDayCount(d, m, y, obki));

                // Следующий день
                current.setDate(current.getDate() + 1);
            }

            // Ждем выполнения всех промисов параллельно
            const counts = await Promise.all(dailyCountsPromises);

            // Логируем результаты и суммируем
            for (let i = 0; i < counts.length; i++) {
                const { d, m, y } = datesForLogging[i];
                const count = counts[i];
                
                console.log(`${utils.padNumber(d, 2)}.${utils.padNumber(m, 2)}.${y} (obki: ${obki}): ${count}`);
                
                totalAll += count;
            }

            console.log("================================");
            console.log("ИТОГО за диапазон:", totalAll);
            console.log("================================");
            
            return totalAll;
        } catch (error) {
            console.error('Ошибка при подсчете диапазона:', error);
            throw error;
        }
    }

    window.addEventListener('load', () => {
        try {
            const headers = Array.from(document.querySelectorAll("h2"));
            if (!headers.length) return;

            const targetHeader = headers.find(h =>
                CONFIG.headerRegex.test(h.innerText.trim())
            );

            if (!targetHeader) return;

            const container = targetHeader.parentElement;
            const text = container.innerText;

            const total = utils.calculateTotal(text, new RegExp(CONFIG.dateRegex.source, 'g'));

            const out = utils.createElement('div', {
                styles: {
                    marginTop: "12px",
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#656360"
                },
                content: `Всего объявлений за день: ${total}`
            });

            targetHeader.insertAdjacentElement("afterend", out);
            
            // Найти существующую форму
            const existingForm = document.querySelector('body > div > form');
            if (!existingForm) return;

            // Найти поля для клонирования
            const dayField = document.querySelector('#form_day');
            const monthField = document.querySelector('#form_month');
            const yearField = document.querySelector('#form_year');
            const buttonToClone = document.querySelector('#form_input');
            if (!dayField || !monthField || !yearField) return;

            // Создать новую форму
            const newForm = utils.createElement('form', {
                attrs: { method: 'post' },
                styles: { marginBottom: '20px' }
            });

            // Создаем div-обертку и копируем стили
            const formWrapper = document.createElement('div');
            const originalWrapper = existingForm.querySelector('div');
            if (originalWrapper) {
                formWrapper.style.cssText = originalWrapper.style.cssText;
                formWrapper.style.display = 'flex';
                formWrapper.style.alignItems = 'center';
            }

            // Клонировать поля в нужном порядке: day, month, year, day, month, year
            const fields = [
                { field: dayField, id: 'cloned_day1' },
                { field: monthField, id: 'cloned_month1' },
                { field: yearField, id: 'cloned_year1' },
                { field: dayField, id: 'cloned_day2' },
                { field: monthField, id: 'cloned_month2' },
                { field: yearField, id: 'cloned_year2' }
            ];

            const clonedFields = fields.map(({ field, id }) => utils.cloneField(field, id));

            const clonedButton = utils.cloneField(buttonToClone);
            clonedButton.value = 'Всего';
            clonedButton.className = 'cloned-total-button';
            
            // Применяем инлайн-стили к кнопке
            Object.entries(CONFIG.buttonStyles).forEach(([key, value]) => {
                clonedButton.style[key] = value;
            });
            
            // Добавляем обработчик для hover-эффекта
            clonedButton.addEventListener('mouseenter', function() {
                this.style.backgroundColor = CONFIG.hoverColor;
                this.style.transform = 'translateY(-1px)';
            });
            
            clonedButton.addEventListener('mouseleave', function() {
                this.style.backgroundColor = CONFIG.normalColor;
                this.style.transform = '';
            });
            
            // Добавляем обработчик клика для кнопки "Всего"
            clonedButton.addEventListener('click', async function(e) {
                e.preventDefault();
                
                // Получаем значения из полей даты
                const [day1, month1, year1] = clonedFields.slice(0, 3).map(f => parseInt(f.value));
                const [day2, month2, year2] = clonedFields.slice(3).map(f => parseInt(f.value));
                
                // Формируем даты в формате YYYY-MM-DD
                const startDateStr = `${utils.padNumber(year1, 4)}-${utils.padNumber(month1, 2)}-${utils.padNumber(day1, 2)}`;
                const endDateStr = `${utils.padNumber(year2, 4)}-${utils.padNumber(month2, 2)}-${utils.padNumber(day2, 2)}`;
                
                // Проверяем, что даты валидны
                if (!utils.isValidDate(startDateStr) || !utils.isValidDate(endDateStr)) {
                    alert('Пожалуйста, введите корректные даты');
                    return;
                }
                
                // Проверяем, что конечная дата не раньше начальной
                const startDate = new Date(startDateStr);
                const endDate = new Date(endDateStr);
                if (endDate < startDate) {
                    alert('Конечная дата должна быть не раньше начальной даты');
                    return;
                }
                
                // Показываем сообщение о начале подсчета
                const originalText = clonedButton.value;
                clonedButton.value = 'Считаем...';
                clonedButton.disabled = true;
                
                try {
                    // Получаем значение из select элемента с id="form_obki_wr"
                    const selectElement = document.getElementById('form_obki_wr');
                    let obkiValue = 8; // значение по умолчанию
                    if (selectElement) {
                        obkiValue = selectElement.value;
                    }

                    // Вызываем функцию подсчета диапазона с учетом obkiValue
                    const total = await countRange(startDateStr, endDateStr, obkiValue);
                    
                    // Отображаем результат в элементе out
                    out.textContent = `Всего объявлений за период с ${startDateStr} по ${endDateStr}: ${total}`;
                } catch (error) {
                    console.error('Ошибка при подсчете объявлений:', error);
                    out.textContent = `Ошибка при подсчете объявлений: ${error.message}`;
                } finally {
                    // Восстанавливаем кнопку
                    clonedButton.value = originalText;
                    clonedButton.disabled = false;
                }
            });
            
            // Добавить клонированные поля в новую форму
            clonedFields.forEach(field => formWrapper.appendChild(field));
            
            

            formWrapper.appendChild(clonedButton);
            newForm.appendChild(formWrapper);
            
            // Вставить новую форму после существующей формы
            existingForm.insertAdjacentElement('afterend', newForm);
        } catch (error) {
            console.error('Ошибка при инициализации скрипта:', error);
        }
    });
})();
