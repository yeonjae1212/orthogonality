import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";

const $ = (id) => document.getElementById(id);

let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let objectGroup = null;
let animationStarted = false;
let transformCount = 0;

function showError(id, message) {
  $(id).innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
}
function clearError(id) { $(id).innerHTML = ""; }
function escapeHtml(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function init3D() {
  const viewport = $("viewport");
  if (!viewport) throw new Error("3D 화면 영역을 찾을 수 없습니다.");

  try {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f2f5);

    camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    camera.position.set(6, 5, 7);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    viewport.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const light = new THREE.DirectionalLight(0xffffff, 0.7);
    light.position.set(5, 8, 5);
    scene.add(light);

    scene.add(new THREE.AxesHelper(3));
    scene.add(new THREE.GridHelper(6, 12));

    objectGroup = new THREE.Group();
    scene.add(objectGroup);

    resize3D();

    if (!animationStarted) {
      animationStarted = true;
      animate();
    }

    $("systemStatus").innerHTML = `<span class="success">3D 화면 초기화 완료</span>`;
  } catch (error) {
    scene = camera = renderer = controls = objectGroup = null;
    throw new Error(`3D 화면 초기화 실패: ${error?.message || error}`);
  }
}

function resize3D() {
  if (!renderer || !camera) return;
  const el = $("viewport");
  const w = Math.max(1, el.clientWidth);
  const h = Math.max(1, el.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize3D);

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

function targetUI() {
  const type = $("targetType").value;
  const d = Number($("dimension").value);
  const box = $("targetInputs");

  if (type === "point") {
    box.innerHTML = `<div class="row">${
      ["x","y","z"].slice(0,d).map(a =>
        `<div><label>${a}</label><input id="p_${a}" value="${a==="x"?"1":a==="y"?"2":"3"}"></div>`
      ).join("")
    }</div>`;
  } else if (type === "curve") {
    box.innerHTML = `<div class="row">${
      ["x","y","z"].slice(0,d).map((a,i) =>
        `<div><label>${a}(t)</label><input id="c_${a}" value="${i===0?"t":i===1?"t^2":"0"}"></div>`
      ).join("")
    }</div>
    <div style="margin-top:8px"><label>t 범위</label><input id="range_t" value="-2..2"></div>`;
  } else {
    box.innerHTML = `<div class="row">${
      ["x","y","z"].slice(0,d).map((a,i) =>
        `<div><label>${a}(u,v)</label><input id="s_${a}" value="${i===0?"u":i===1?"v":"0"}"></div>`
      ).join("")
    }</div>
    <div class="row" style="margin-top:8px">
      <div><label>u 범위</label><input id="range_u" value="-2..2"></div>
      <div><label>v 범위</label><input id="range_v" value="-2..2"></div>
    </div>`;
  }
}
$("targetType").addEventListener("change", targetUI);
$("dimension").addEventListener("change", targetUI);

function addTransform(expr="") {
  transformCount++;
  const n = transformCount;
  const div = document.createElement("div");
  div.className = "transform";
  div.dataset.n = String(n);
  div.innerHTML = `
    <div class="transform-head">
      <span class="transform-title">A${n}</span>
      <button type="button" class="small danger remove">삭제</button>
    </div>
    <label>행렬 또는 행렬식</label>
    <textarea class="texpr" placeholder="예: Rz(pi/2)
또는 [0,-1,0;1,0,0;0,0,1]
또는 A2^T">${escapeHtml(expr)}</textarea>
    <div class="help">이전 행렬 참조: <code>A1</code>, 전치: <code>A2^T</code> 또는 <code>transpose(A2)</code></div>
    <div class="preview"></div>
  `;
  div.querySelector(".remove").addEventListener("click", () => {
    div.remove();
    renumberTransforms();
  });
  div.querySelector(".texpr").addEventListener("input", previewTransforms);
  $("transforms").appendChild(div);
  previewTransforms();
}
function renumberTransforms() {
  [...document.querySelectorAll(".transform")].forEach((el,i) => {
    el.querySelector(".transform-title").textContent = `A${i+1}`;
  });
  transformCount = document.querySelectorAll(".transform").length;
  previewTransforms();
}
$("addTransform").addEventListener("click", () => addTransform());

function normalizeExpr(expr) {
  let s = expr.trim();
  s = s.replace(/([A-Za-z]\w*)\s*\^T\b/g, "transpose($1)");
  s = s.replace(/([A-Za-z]\w*)\s*\^t\b/g, "transpose($1)");
  return s;
}

function rotationMatrix(axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  if (axis === "x") return math.matrix([[1,0,0],[0,c,-s],[0,s,c]]);
  if (axis === "y") return math.matrix([[c,0,s],[0,1,0],[-s,0,c]]);
  return math.matrix([[c,-s,0],[s,c,0],[0,0,1]]);
}

function matrixFromExpr(expr, scope) {
  const s = normalizeExpr(expr);
  const rotation = s.match(/^R([xyz])\((.*)\)$/i);

  if (rotation) {
    const angle = Number(math.evaluate(rotation[2], scope));
    if (!Number.isFinite(angle)) throw new Error("회전각이 유효한 실수가 아닙니다.");
    return rotationMatrix(rotation[1].toLowerCase(), angle);
  }

  const result = math.evaluate(s, scope);
  if (!result || typeof result.toArray !== "function") {
    throw new Error("행렬로 해석되지 않았습니다.");
  }
  const a = result.toArray();
  if (!Array.isArray(a) || !Array.isArray(a[0])) {
    throw new Error("결과가 행렬이 아닙니다.");
  }
  if (!a.length || a.some(row => !Array.isArray(row)) || a.some(row => row.length !== a[0].length)) {
    throw new Error("행렬의 각 행 길이가 서로 다릅니다.");
  }
  return math.matrix(a);
}

function buildMatrices() {
  const elements = [...document.querySelectorAll(".transform")];
  if (!elements.length) throw new Error("변환 행렬을 하나 이상 추가하세요.");

  const scope = {};
  const matrices = [];

  for (let i=0; i<elements.length; i++) {
    const expr = elements[i].querySelector(".texpr").value.trim();
    if (!expr) throw new Error(`A${i+1}: 입력이 비어 있습니다.`);

    try {
      const matrix = matrixFromExpr(expr, scope);
      matrices.push(matrix);
      scope[`A${i+1}`] = matrix;
    } catch (error) {
      throw new Error(`A${i+1}: ${error?.message || error}`);
    }
  }
  return { matrices, scope };
}

function previewTransforms() {
  try {
    const { matrices } = buildMatrices();
    document.querySelectorAll(".transform").forEach((el,i) => {
      const size = matrices[i].size();
      el.querySelector(".preview").innerHTML =
        `<span class="success">유효한 ${size[0]} x ${size[1]} 행렬</span>`;
    });
    clearError("transformError");
  } catch (error) {
    showError("transformError", error.message);
    document.querySelectorAll(".preview").forEach(el => el.textContent = "");
  }
}

function parseRange(text, name) {
  const match = text.trim().match(/^\s*(-?(?:\d+(?:\.\d*)?|\.\d+))\s*\.\.\s*(-?(?:\d+(?:\.\d*)?|\.\d+))\s*$/);
  if (!match) throw new Error(`${name} 범위는 -2..2 같은 형식으로 입력하세요.`);
  const lo = Number(match[1]), hi = Number(match[2]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) {
    throw new Error(`${name} 범위가 올바르지 않습니다.`);
  }
  return [lo, hi];
}

function evalExpr(expr, vars) {
  try {
    const value = Number(math.evaluate(expr, vars));
    if (!Number.isFinite(value)) throw new Error("결과가 실수가 아닙니다.");
    return value;
  } catch (error) {
    throw new Error(`식 "${expr}"을 계산할 수 없습니다: ${error?.message || error}`);
  }
}

function samplePoints() {
  const type = $("targetType").value;
  const d = Number($("dimension").value);
  const pts = [];

  if (type === "point") {
    return [["x","y","z"].slice(0,d).map(a => evalExpr($(`p_${a}`).value, {}))];
  }

  if (type === "curve") {
    const expressions = ["x","y","z"].slice(0,d).map(a => $(`c_${a}`).value);
    const [lo,hi] = parseRange($("range_t").value, "t");
    for (let i=0;i<=160;i++) {
      const t = lo + (hi-lo)*i/160;
      pts.push(expressions.map(expr => evalExpr(expr,{t})));
    }
    return pts;
  }

  const expressions = ["x","y","z"].slice(0,d).map(a => $(`s_${a}`).value);
  const [ulo,uhi] = parseRange($("range_u").value, "u");
  const [vlo,vhi] = parseRange($("range_v").value, "v");

  for (let i=0;i<=18;i++) {
    for (let j=0;j<=18;j++) {
      const u = ulo + (uhi-ulo)*i/18;
      const v = vlo + (vhi-vlo)*j/18;
      pts.push(expressions.map(expr => evalExpr(expr,{u,v})));
    }
  }
  return pts;
}

function applyMatrix(M, vector) {
  const size = M.size();
  if (size.length !== 2 || size[0] !== size[1]) {
    throw new Error("변환 행렬은 정사각행렬이어야 합니다.");
  }
  if (size[0] !== vector.length) {
    throw new Error(`차원 불일치: ${size[0]} x ${size[1]} 행렬에 ${vector.length}차원 벡터를 적용할 수 없습니다.`);
  }
  return math.multiply(M, math.matrix(vector)).toArray();
}

function clearObjects() {
  if (!objectGroup) return;
  while (objectGroup.children.length) objectGroup.remove(objectGroup.children[0]);
}

function to3(v) {
  return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
}

function makeLine(points, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map(to3).map(v => new THREE.Vector3(...v))
  );
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({color}));
}

function drawObject(points, type, color) {
  if (!objectGroup) return;

  if (type === "point") {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09,16,16),
      new THREE.MeshBasicMaterial({color})
    );
    mesh.position.set(...to3(points[0]));
    objectGroup.add(mesh);
    return;
  }

  if (type === "curve") {
    objectGroup.add(makeLine(points, color));
    return;
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map(v => new THREE.Vector3(...to3(v)))
  );
  objectGroup.add(new THREE.Points(
    geometry,
    new THREE.PointsMaterial({size:0.045,color})
  ));
}

function fmtMatrix(M) {
  return JSON.stringify(M.toArray(), null, 2);
}

function near(a,b,tol=1e-8) {
  return Math.abs(a-b) <= tol;
}

function analyze(composite, points, transformed) {
  const size = composite.size();
  const n = size[0];
  const AT = math.transpose(composite);
  const ATA = math.multiply(AT, composite);
  const determinant = math.det(composite);

  let orthogonal = true;
  const gram = ATA.toArray();
  for (let i=0;i<n;i++) {
    for (let j=0;j<n;j++) {
      if (!near(gram[i][j], i===j ? 1 : 0)) orthogonal = false;
    }
  }

  let inverseStatus = "계산 가능";
  try {
    math.inv(composite);
  } catch {
    inverseStatus = "계산 불가";
  }

  $("composite").innerHTML = `<pre>${escapeHtml(fmtMatrix(composite))}</pre>`;

  $("orthogonal").innerHTML = `
    <div><b>${orthogonal ? "✓ 직교행렬" : "✗ 직교행렬이 아님"}</b></div>
    <div>det(A) = ${Number(determinant).toFixed(6)}</div>
    <div>A^T A = ${orthogonal ? "I" : "I 아님"}</div>
    <div>A^-1 = A^T: ${orthogonal ? "✓" : "검사 필요"}</div>
    <div>역행렬: ${inverseStatus}</div>
  `;

  $("steps").innerHTML = `총 ${document.querySelectorAll(".transform").length}개 변환<br>` +
    [...document.querySelectorAll(".transform")].map((el,i) => {
      const s = JSON.parse(el.querySelector(".preview").textContent.match(/\d+ x \d+/)?.[0]?.replace(" x ",",") || "[?]");
      return `A${i+1}`;
    }).join(" → ");

  if (points.length && transformed.length) {
    const p0 = points[0], p1 = transformed[0];
    const len0 = Math.hypot(...p0);
    const len1 = Math.hypot(...p1);
    const ratio = len0 > 1e-12 ? len1/len0 : null;
    $("preserve").innerHTML = `
      첫 벡터 길이: ${len0.toFixed(6)} → ${len1.toFixed(6)}<br>
      길이 보존: ${near(len0,len1,1e-7) ? "✓" : "✗"}<br>
      길이 비율: ${ratio === null ? "정의 안 됨" : ratio.toFixed(6)}
    `;
  }
}

function render() {
  const d = Number($("dimension").value);
  const type = $("targetType").value;
  const points = samplePoints();
  const { matrices } = buildMatrices();

  for (let i=0;i<matrices.length;i++) {
    const size = matrices[i].size();
    if (size.length !== 2 || size[0] !== d || size[1] !== d) {
      throw new Error(`A${i+1}: ${d}D 대상에는 ${d} x ${d} 행렬이 필요합니다. 현재 ${size.join(" x ")}.`);
    }
  }

  let composite = math.identity(d);
  for (const matrix of matrices) {
    composite = math.multiply(matrix, composite);
  }

  const transformed = points.map(v => applyMatrix(composite,v));

  clearObjects();
  drawObject(points,type,0x315efb);
  drawObject(transformed,type,0xd14b3f);

  if (type === "point") {
    objectGroup?.add(makeLine([points[0], transformed[0]],0x555555));
  }

  analyze(composite,points,transformed);
  $("viewInfo").textContent = `파랑: 원본 · 빨강: 변환 결과 · ${points.length}개 샘플`;
}

$("run").addEventListener("click", () => {
  clearError("targetError");
  clearError("transformError");

  try {
    // 3D view is optional for calculation: initialize if needed, then calculate.
    if (!scene || !objectGroup) {
      try {
        init3D();
      } catch (viewError) {
        $("systemStatus").innerHTML =
          `<span>3D 화면은 사용할 수 없습니다. 계산 결과는 계속 표시합니다.<br>${escapeHtml(viewError.message)}</span>`;
      }
    }

    render();
  } catch (error) {
    showError("targetError", `변환 실행 오류: ${error?.message || error}`);
  }
});

$("reset").addEventListener("click", () => location.reload());

targetUI();
addTransform("[0,-1,0;1,0,0;0,0,1]");

try {
  init3D();
} catch (error) {
  $("systemStatus").innerHTML =
    `<span>3D 화면 초기화 실패. 행렬 계산 기능은 사용할 수 있습니다.<br>${escapeHtml(error.message)}</span>`;
}
