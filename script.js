document.addEventListener("DOMContentLoaded", function() {
    // Collapsible section logic
    const coll = document.getElementsByClassName("collapsible");
    for (let i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function() {
            this.classList.toggle("active");
            var content = this.nextElementSibling;
            if (content.style.maxHeight){
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            } 
        });
    }

    // --- Configuration and Chart Logic ---

    // DOM Elements
    const lengthInput = document.getElementById('length');
    const widthInput = document.getElementById('width');
    const maxDepthInput = document.getElementById('maxDepth');
    const topMarginInput = document.getElementById('topMargin');
    const groupBySelect = document.getElementById('groupBy');
    const lastDaysInput = document.getElementById('lastDays');
    const autoRefreshInput = document.getElementById('autoRefresh');
    const resetConfigBtn = document.getElementById('resetConfigBtn');

    const ctx = document.getElementById('distanceChart').getContext('2d');
    let chart;
    let apiData;
    let refreshIntervalId = null;

    const defaultConfig = {
        length: 114,
        width: 30,
        maxDepth: 40,
        topMargin: 3,
        groupBy: 'hours',
        lastDays: 7,
        autoRefresh: 10
    };

    function createOrUpdateChart() {
        if (!apiData || !apiData.feeds || apiData.feeds.length === 0) {
            document.getElementById('last-read-timestamp').textContent = 'Last read: No data available';
            document.getElementById('last-read-level').textContent = '';
            if (chart) chart.destroy();
            return;
        }

        const maxDepth = parseFloat(maxDepthInput.value) || 0;
        const topMargin = parseFloat(topMarginInput.value) || 0;
        const totalDepth = maxDepth + topMargin;

        // Update last read timestamp and level
        const lastEntry = apiData.feeds[apiData.feeds.length - 1];
        const lastReadDate = new Date(lastEntry.created_at);
        const lastWaterLevel = totalDepth - parseFloat(lastEntry.field1);
        document.getElementById('last-read-timestamp').textContent = `Last read: ${lastReadDate.toLocaleString()}`;
        document.getElementById('last-read-level').textContent = `Last water level: ${lastWaterLevel.toFixed(2)} cm`;

        const groupBy = groupBySelect.value;

        const entries = apiData.feeds;

        let labels = [];
        let values = [];

        if (groupBy === 'minutes') {
            labels = entries.map(entry => {
                const date = new Date(entry.created_at);
                return date.toLocaleString();
            });
            values = entries.map(entry => {
                const distance = parseFloat(entry.field1);
                return totalDepth - distance;
            });
        } else if (groupBy === 'hours') {
            const hourlyData = {}; // { 'YYYY-MM-DD HH:00': { sum: X, count: Y } }
            entries.forEach(entry => {
                const date = new Date(entry.created_at);
                const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;

                if (!hourlyData[hourKey]) {
                    hourlyData[hourKey] = { sum: 0, count: 0 };
                }
                const waterLevel = totalDepth - parseFloat(entry.field1);
                if (!isNaN(waterLevel)) {
                    hourlyData[hourKey].sum += waterLevel;
                    hourlyData[hourKey].count++;
                }
            });

            const sortedHours = Object.keys(hourlyData).sort();
            labels = sortedHours;
            values = sortedHours.map(hour => hourlyData[hour].sum / hourlyData[hour].count);
        } else if (groupBy === 'days') {
            const dailyData = {}; // { 'YYYY-MM-DD': { sum: X, count: Y } }
            entries.forEach(entry => {
                const date = new Date(entry.created_at);
                const day = date.toISOString().split('T')[0];
                if (!dailyData[day]) {
                    dailyData[day] = { sum: 0, count: 0 };
                }
                const waterLevel = totalDepth - parseFloat(entry.field1);
                if (!isNaN(waterLevel)) {
                    dailyData[day].sum += waterLevel;
                    dailyData[day].count++;
                }
            });

            const sortedDays = Object.keys(dailyData).sort();
            labels = sortedDays;
            values = sortedDays.map(day => dailyData[day].sum / dailyData[day].count);
        }

        if (chart) {
            chart.destroy();
        }

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Water level (cm)',
                    data: values,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: groupBy === 'days' ? 'Date' : 'Time'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Water level (cm)'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function fetchDataAndUpdateChart() {
        const days = parseInt(lastDaysInput.value, 10) || 1;
        const results = days * 1440; // Assuming 1 entry per minute
        const url = `https://api.thingspeak.com/channels/3153556/fields/1.json?results=${results}`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                apiData = data;
                createOrUpdateChart();
            })
            .catch(error => console.error("Error fetching data:", error));
    }

    function resetAutoRefresh() {
        if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
        }
        const intervalSeconds = parseInt(autoRefreshInput.value, 10);
        if (intervalSeconds > 0) {
            const intervalMilliseconds = intervalSeconds * 1000;
            refreshIntervalId = setInterval(fetchDataAndUpdateChart, intervalMilliseconds);
        }
    }

    // --- Configuration Management ---

    function saveConfig() {
        const currentConfig = {
            length: lengthInput.value,
            width: widthInput.value,
            maxDepth: maxDepthInput.value,
            topMargin: topMarginInput.value,
            groupBy: groupBySelect.value,
            lastDays: lastDaysInput.value,
            autoRefresh: autoRefreshInput.value,
        };
        sessionStorage.setItem('hydroConfig', JSON.stringify(currentConfig));
    }

    function loadConfig() {
        const savedConfig = JSON.parse(sessionStorage.getItem('hydroConfig'));
        const config = savedConfig || defaultConfig;

        lengthInput.value = config.length;
        widthInput.value = config.width;
        maxDepthInput.value = config.maxDepth;
        topMarginInput.value = config.topMargin;
        groupBySelect.value = config.groupBy;
        lastDaysInput.value = config.lastDays;
        autoRefreshInput.value = config.autoRefresh;
    }

    function resetConfig() {
        sessionStorage.removeItem('hydroConfig');
        loadConfig(); // Loads defaults
        fetchDataAndUpdateChart();
        resetAutoRefresh();
    }

    // --- Initialization and Event Listeners ---

    loadConfig();
    fetchDataAndUpdateChart();
    resetAutoRefresh();

    // Add event listeners
    const configInputs = [lengthInput, widthInput, maxDepthInput, topMarginInput, groupBySelect, lastDaysInput, autoRefreshInput];
    configInputs.forEach(input => {
        input.addEventListener('change', () => {
            saveConfig();
            if (input === lastDaysInput) {
                fetchDataAndUpdateChart();
            } else if (input === autoRefreshInput) {
                resetAutoRefresh();
            } else {
                createOrUpdateChart();
            }
        });
    });

    resetConfigBtn.addEventListener('click', resetConfig);
});

