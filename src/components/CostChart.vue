<script setup lang="ts">
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from "chart.js";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
const props=defineProps<{labels:string[];values:number[]}>();const canvas=ref<HTMLCanvasElement>();let chart:Chart|undefined;
Chart.register(BarController,BarElement,CategoryScale,LinearScale,Tooltip);
function draw(){chart?.destroy();if(!canvas.value)return;chart=new Chart(canvas.value,{type:'bar',data:{labels:props.labels,datasets:[{data:props.values,backgroundColor:'#0f8f8d',borderRadius:3,barThickness:16}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'#e6edf2'},ticks:{color:'#64748b'}},y:{grid:{display:false},ticks:{color:'#10263d',font:{weight:700}}}}}})}
onMounted(draw);watch(()=>[props.labels,props.values],draw,{deep:true});onBeforeUnmount(()=>chart?.destroy());
</script><template><div class="cost-chart"><canvas ref="canvas"></canvas></div></template>
