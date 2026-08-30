document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('audit-form');
    const urlInput = document.getElementById('url-input');
    const resultsContainer = document.getElementById('results-container');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const targetUrl = urlInput.value.trim();

        if (!targetUrl) return;

        resultsContainer.innerHTML = '<p>An audit is in progress please wait...</p>';

        try {
            const response = await fetch('http://localhost:8000/api/audit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: targetUrl }),
            });

            const data = await response.json();

            if (!response.ok) {
                const message = Array.isArray(data.detail)
                    ? data.detail.map(d => d.msg).join(', ')
                    : (data.detail || 'The server returned an unknown error.');
                throw new Error(message);
            }

            resultsContainer.innerHTML = `
                <h3>Audit results:</h3>
                <pre>${JSON.stringify(data, null, 2)}</pre>
            `;

        } catch (error) {
            resultsContainer.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    });
});