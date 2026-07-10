<script setup lang="ts">
import {
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { GemPriceTrendPoint } from "../../domain/gemPriceHistory";

const props = defineProps<{ points: GemPriceTrendPoint[]; names: string[] }>();
const canvas = ref<HTMLCanvasElement>();
let chart: Chart | undefined;

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip, Legend);

const colors = ["#d96b0b", "#2f73b8", "#8f63c6", "#283f59", "#c84b43", "#24845f"];

function labelFor(point: GemPriceTrendPoint) {
  const date = new Date(point.capturedAt);
  const formatted = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: point.source === "baseline" ? undefined : "2-digit",
    minute: point.source === "baseline" ? undefined : "2-digit",
    hour12: false,
  }).format(date);
  return point.source === "baseline" ? `${formatted} 基准` : formatted;
}

function draw() {
  chart?.destroy();
  if (!canvas.value) return;
  chart = new Chart(canvas.value, {
    type: "line",
    data: {
      labels: props.points.map(labelFor),
      datasets: props.names.map((name, index) => ({
        label: name,
        data: props.points.map((point) => point.items.find((item) => item.name === name)?.price ?? null),
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length],
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: .28,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom", labels: { color: "#34465b", boxWidth: 18, boxHeight: 2, padding: 18, font: { size: 12, weight: 700 } } },
        tooltip: { callbacks: { label: (context) => `${context.dataset.label}：${context.formattedValue} 银币` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#66758a", font: { size: 11 } } },
        y: { beginAtZero: false, grid: { color: "#e4e6e8" }, ticks: { color: "#66758a", font: { size: 11 } } },
      },
    },
  });
}

onMounted(draw);
watch(() => [props.points, props.names], draw, { deep: true });
onBeforeUnmount(() => chart?.destroy());
</script>

<template><div class="gem-trend-chart"><canvas ref="canvas"></canvas></div></template>
