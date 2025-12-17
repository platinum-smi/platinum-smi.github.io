// ==UserScript==
// @name         Подсчет объявлений djoniohanter.com/smi
// @namespace    http://tampermonkey.net/
// @version      2.2.1
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
    async function getDayCount(day, month, year, obki = 8, maxRetries = 3) {
        console.log(`Начало запроса для даты: ${utils.padNumber(day, 2)}.${utils.padNumber(month, 2)}.${year}, obki: ${obki}, maxRetries: ${maxRetries}`);
        
        // Функция для задержки
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const startTime = performance.now();
                const payload = new URLSearchParams({
                    search_platinum: "",
                    day: utils.padNumber(day, 2),
                    month: utils.padNumber(month, 2),
                    year: year.toString(),
                    obki_wr: obki.toString()
                });

                console.log(`Отправка запроса для даты: ${utils.padNumber(day, 2)}.${utils.padNumber(month, 2)}.${year}, payload: ${payload.toString()}, попытка: ${attempt}`);
                
                // Реализация таймаута для fetch с помощью Promise.race
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Request timeout')), 30000); // 30 секунд таймаут
                });
                
                const fetchPromise = fetch("https://djoniohanter.com/smi.php", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: payload.toString()
                });
                
                const response = await Promise.race([fetchPromise, timeoutPromise]);

                const endTime = performance.now();
                const duration = endTime - startTime;
                
                console.log(`Request to https://djoniohanter.com/smi.php for ${utils.padNumber(day, 2)}.${utils.padNumber(month, 2)}.${year} completed in ${duration.toFixed(2)}ms`);
                
                console.log(`Получен ответ для даты: ${utils.padNumber(day, 2)}.${utils.padNumber(month, 2)}.${year}, статус: ${response.status}`);
                
                if (!response.ok) {
                    console.log(`Ошибка HTTP для даты: ${utils.padNumber(day, 2)}.${utils.padNumber(month, 2)}.${year}, статус: ${response.status}`);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const html = await response.text();
                console.log(`Получен HTML-ответ для даты: ${utils.padNumber(day, 2)}.${utils.padNumber(month, 2)}.${year}, длина: ${html.length}`);

                // Парсим HTML в виртуальный DOM
                const doc = new DOMParser().parseFromString(html, "text/html");

                // Ищем все элементы <p> с классом 'employee-count'
                const employeeCountParagraphs = doc.querySelectorAll('p.employee-count');
                let total = 0;

                employeeCountParagraphs.forEach(p => {
                    const paragraphText = p.innerText;
                    total += utils.calculateTotal(paragraphText, new RegExp(CONFIG.dateRegex.source, 'g'));
                });
                
                console.log(`Завершение запроса для даты: ${utils.padNumber(day, 2)}.${utils.padNumber(month, 2)}.${year}, результат: ${total}`);
                return total;
            } catch (error) {
                console.error(`Ошибка при получении количества объявлений за ${utils.padNumber(day, 2)}.${utils.padNumber(month, 2)}.${year} (попытка ${attempt}/${maxRetries}):`, error);
                
                // Если это последняя попытка, выбрасываем ошибку
                if (attempt === maxRetries) {
                    console.error(`Все попытки исчерпаны для даты ${utils.padNumber(day, 2)}.${utils.padNumber(month, 2)}.${year}. Ошибка:`, error);
                    throw error;
                }
                
                // Ждем перед повторной попыткой (экспоненциальное увеличение задержки)
                const waitTime = Math.pow(2, attempt) * 1000; // 2^attempt * 1000ms
                console.log(`Ожидание ${waitTime}мс перед повторной попыткой для даты ${utils.padNumber(day, 2)}.${utils.padNumber(month, 2)}.${year}...`);
                await delay(waitTime);
            }
        }
    }

    // Функция для ограничения количества параллельных запросов
    async function processPromisesWithLimit(promiseFactories, limit) {
        const results = [];
        const runningPromises = [];

        for (const promiseFactory of promiseFactories) {
            // Оборачиваем каждый промис в обработчик ошибок, чтобы он не прерывал выполнение
            const p = promiseFactory()
                .then(result => ({ success: true, result }))
                .catch(error => ({ success: false, error }));
                
            runningPromises.push(p);
            p.then(resultObj => {
                results.push(resultObj);
                const index = runningPromises.indexOf(p);
                if (index !== -1) {
                    runningPromises.splice(index, 1); // Удаляем завершенный промис
                }
            });

            if (runningPromises.length >= limit) {
                await Promise.race(runningPromises); // Ждем завершения любого из текущих промисов
            }
        }

        await Promise.all(runningPromises); // Ждем завершения всех оставшихся промисов
        return results;
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
            
            // Массивы для хранения фабрик промисов и дат для логирования
            const promiseFactories = [];
            const datesForLogging = [];

            console.log(`Начало обработки диапазона дат: ${from} - ${to}, obki: ${obki}`);
            
            while (current <= endDate) {
                const d = current.getDate();
                const m = current.getMonth() + 1;
                const y = current.getFullYear();

                // Сохраняем дату для последующего логирования
                datesForLogging.push({ d, m, y });

                // Добавляем фабрику промиса в массив
                console.log(`Создание фабрики промиса для даты: ${utils.padNumber(d, 2)}.${utils.padNumber(m, 2)}.${y}`);
                promiseFactories.push(() => getDayCount(d, m, y, obki, 3)); // 3 попытки

                // Следующий день
                current.setDate(current.getDate() + 1);
            }
            
            console.log(`Общее количество фабрик промисов для выполнения с ограничением: ${promiseFactories.length}`);

            // Ждем выполнения промисов с ограничением на количество одновременных запросов
            console.log('Начало выполнения промисов с ограничением на 2 параллельных запроса...');
            const results = await processPromisesWithLimit(promiseFactories, 2);
            console.log('Завершено выполнение всех промисов с ограничением');

            // Логируем результаты и суммируем, учитывая возможные ошибки
            for (let i = 0; i < results.length; i++) {
                const { d, m, y } = datesForLogging[i];
                const resultObj = results[i];
                
                if (resultObj.success) {
                    const count = resultObj.result;
                    console.log(`${utils.padNumber(d, 2)}.${utils.padNumber(m, 2)}.${y} (obki: ${obki}): ${count}`);
                    totalAll += count;
                } else {
                    console.error(`Ошибка получения данных для ${utils.padNumber(d, 2)}.${utils.padNumber(m, 2)}.${y}:`, resultObj.error);
                    // В случае ошибки, можно показать пользователю уведомление
                    out.textContent = `Частичная ошибка: не удалось получить данные за некоторые даты. Итого на данный момент: ${totalAll}`;
                }
            }

            console.log("================================");
            console.log("ИТОГО за диапазон:", totalAll);
            console.log("================================");
            
            // Если были ошибки, покажем это в конце
            const errorCount = results.filter(r => !r.success).length;
            if (errorCount > 0) {
                console.warn(`Получены частичные данные: ${errorCount} из ${results.length} дат не удалось получить`);
            }
            
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
            let total = 0;
            if (container) {
                const employeeCountParagraphs = container.querySelectorAll('p.employee-count');
                employeeCountParagraphs.forEach(p => {
                    const paragraphText = p.innerText;
                    total += utils.calculateTotal(paragraphText, new RegExp(CONFIG.dateRegex.source, 'g'));
                });
            }

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

                    console.log(`Начало подсчета диапазона с ${startDateStr} по ${endDateStr}, obki: ${obkiValue}`);
                    
                    // Вызываем функцию подсчета диапазона с учетом obkiValue
                    const total = await countRange(startDateStr, endDateStr, obkiValue);
                    
                    // Отображаем результат в элементе out
                    out.textContent = `Всего объявлений за период с ${startDateStr} по ${endDateStr}: ${total}`;
                    
                    console.log(`Завершение подсчета диапазона, итоговый результат: ${total}`);
                } catch (error) {
                    console.error('Ошибка при подсчете объявлений:', error);
                    // Проверяем, является ли ошибка частичной (т.е. часть данных была получена)
                    if (error.message && error.message.includes('частичные данные')) {
                        // Сообщение уже установлено в countRange, так что оставляем его
                    } else {
                        out.textContent = `Ошибка при подсчете объявлений: ${error.message}`;
                    }
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
