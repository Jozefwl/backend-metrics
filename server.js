const express = require('express');
const axios = require('axios');
const app = express();
const port = 5000;

// Prometheus server URL
const nodeExporterUrl = 'http://192.168.0.100:9100'; // Change this to your Prometheus server URL

let prevCpuMetrics = null;
let prevTimestamp = null;

async function fetchMetrics() {
  try {
    const res = await axios.get(`${nodeExporterUrl}/metrics`);
    const text = res.data;
    const currentTimestamp = Date.now();
    
    // Parse CPU metrics with proper label handling
    const cpuMetrics = {};
    const cpuRegex = /node_cpu_seconds_total{cpu="(\d+)",mode="([^"]+)"[^}]*} (\d+\.\d+)/g;
    let match;
    
    while ((match = cpuRegex.exec(text)) !== null) {
      const cpu = match[1];
      const mode = match[2];
      const value = parseFloat(match[3]);
      
      if (!cpuMetrics[cpu]) cpuMetrics[cpu] = {};
      cpuMetrics[cpu][mode] = value;
    }
    
    let cpuUsage = 0;
    
    // Calculate CPU usage based on rate if we have previous measurements
    if (prevCpuMetrics && prevTimestamp) {
      const timeDiffSeconds = (currentTimestamp - prevTimestamp) / 1000;
      let totalCpus = 0;
      let totalUsage = 0;
      
      Object.keys(cpuMetrics).forEach(cpu => {
        if (prevCpuMetrics[cpu]) {
          totalCpus++;
          
          // Calculate total and idle CPU time differences
          const prevTotal = Object.values(prevCpuMetrics[cpu]).reduce((sum, val) => sum + val, 0);
          const currentTotal = Object.values(cpuMetrics[cpu]).reduce((sum, val) => sum + val, 0);
          
          const prevIdle = prevCpuMetrics[cpu]['idle'] || 0;
          const currentIdle = cpuMetrics[cpu]['idle'] || 0;
          
          const totalDiff = currentTotal - prevTotal;
          const idleDiff = currentIdle - prevIdle;
          
          if (totalDiff > 0) {
            // Calculate usage percentage for this CPU core
            const coreCpuUsage = ((totalDiff - idleDiff) / totalDiff) * 100;
            totalUsage += coreCpuUsage;
          }
        }
      });
      
      // Average CPU usage across all cores
      cpuUsage = totalCpus > 0 ? totalUsage / totalCpus : 0;
    }
    
    // Memory Metrics
    const memRegex = {
      available: /node_memory_MemAvailable_bytes\s+(\d+)/,
      total: /node_memory_MemTotal_bytes\s+(\d+)/
    };
    
    const memAvailable = (text.match(memRegex.available) || [0, 0])[1];
    const memTotal = (text.match(memRegex.total) || [0, 0])[1];
    const memoryUsage = memTotal > 0 ? ((1 - memAvailable / memTotal) * 100) : 0;
    
    // Store current metrics for next calculation
    prevCpuMetrics = cpuMetrics;
    prevTimestamp = currentTimestamp;
    
    return { 
      cpuUsage: parseFloat(cpuUsage.toFixed(2)), 
      memoryUsage: parseFloat(memoryUsage.toFixed(2)) 
    };
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
