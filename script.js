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

    // Chart logic
    const url = "https://api.thingspeak.com/channels/3153556/fields/1.json?results=1440";
    const maxDepthInput = document.getElementById('maxDepth');
    const topMarginInput = document.getElementById('topMargin');
    const ctx = document.getElementById('distanceChart').getContext('2d');
    let chart;
    let apiData;

    function createOrUpdateChart() {
        if (!apiData) return;

        const maxDepth = parseFloat(maxDepthInput.value) || 0;
        const topMargin = parseFloat(topMarginInput.value) || 0;
        const totalDepth = maxDepth + topMargin;

        const entries = apiData.feeds;

        const labels = entries.map(entry => {
            const date = new Date(entry.created_at);
            return date.getHours() + ":" + String(date.getMinutes()).padStart(2, '0');
        });

        const values = entries.map(entry => {
            const distance = parseFloat(entry.field1);
            return totalDepth - distance;
        });

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
                            text: 'Time (HH:MM)'
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

    fetch(url)
        .then(response => response.json())
        .then(data => {
            apiData = data;
            createOrUpdateChart();
        })
        .catch(error => console.error("Error fetching data:", error));

    maxDepthInput.addEventListener('input', createOrUpdateChart);
    topMarginInput.addEventListener('input', createOrUpdateChart);
});

