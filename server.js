const express = require('express');
const axios = require('axios');
const app = express();
const port = 5000;

// Prometheus server URL
const nodeExporterUrl = 'http://localhost:9100'; // Change this to your Prometheus server URL

// Function to fetch metrics from Prometheus
async function fetchMetrics() {
  try {
    const res = await axios.get(`${nodeExporterUrl}/metrics`);
    const text = res.data;

    // Helper function to get the sum of a metric, possibly filtered by labels
    const get = (name, filter = '') => {
      const regex = new RegExp(`^${name}${filter}(\\{[^}]*\\})?\\s+(\\d+\\.?\\d*)`, 'gm');
      const match = text.matchAll(regex);
      let total = 0;

      for (const m of match) {
        total += parseFloat(m[2]);
      }

      return total;
    };

    // CPU Metrics
    const cpuUser = get('node_cpu_seconds_total', '{mode="user"}');
    const cpuSystem = get('node_cpu_seconds_total', '{mode="system"}');
    const cpuIdle = get('node_cpu_seconds_total', '{mode="idle"}');

    // Calculate CPU usage percentage
    const totalCpuTime = cpuUser + cpuSystem + cpuIdle;
    const cpuUsage = totalCpuTime > 0 ? ((cpuUser + cpuSystem) / totalCpuTime) * 100 : 0;

    // Memory Metrics
    const memAvailable = get('node_memory_MemAvailable_bytes');
    const memTotal = get('node_memory_MemTotal_bytes');
    const memoryUsage = memTotal > 0 ? ((1 - memAvailable / memTotal) * 100) : null;

    return { cpuUsage, memoryUsage };
  } catch (err) {
    console.error('Error fetching metrics:', err);
    throw err;
  }
}


app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Allow all origins
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// API endpoint to get the metrics
app.get('/', async (req, res) => {
    res.send('Welcome to the metrics API! Visit /metrics for metrics regarding CPU and MEMORY usage!');
});

app.get('/metrics', async (req, res) => {
  try {
    const metrics = await fetchMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
