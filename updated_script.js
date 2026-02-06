// Toggle Visibility Function
function toggleWCInput() {
    const mode = document.getElementById("wcMode").value;
    const manualContainer = document.getElementById("manualWCContainer");
    manualContainer.style.display = (mode === "manual") ? "block" : "none";
}

document.getElementById("mixForm").addEventListener("submit", function(e) {
  e.preventDefault();

  // 1. INPUTS
  const fck = parseFloat(document.getElementById("fck").value);
  const slump = parseInt(document.getElementById("slump").value);
  const exposure = document.getElementById("exposure").value;
  const maxAggSize = parseInt(document.getElementById("maxAggSize").value);
  const cementCategory = document.getElementById("cementCategory").value;
  const wcMode = document.getElementById("wcMode").value;
  
  const isPumpable = document.getElementById("pumpable").value === "yes";
  const sgCement = parseFloat(document.getElementById("sgCement").value);
  const faZone = parseInt(document.getElementById("faZone").value);
  const sgFA = parseFloat(document.getElementById("sgFA").value);
  const sgCA = parseFloat(document.getElementById("sgCA").value);
  const absFA = parseFloat(document.getElementById("absFA").value);
  const absCA = parseFloat(document.getElementById("absCA").value);
  const mcFA = parseFloat(document.getElementById("mcFA").value);
  const mcCA = parseFloat(document.getElementById("mcCA").value);
  const admixtureType = document.getElementById("admixtureType").value;
  const sgPlasticizer = parseFloat(document.getElementById("sgPlasticizer").value);
  const plasticizerDosage = 1.0; 

  // 2. TARGET STRENGTH
  let S, X; 
  if (fck <= 15) { S = 3.5; X = 5.0; } 
  else if (fck <= 25) { S = 4.0; X = 5.5; } 
  else if (fck <= 55) { S = 5.0; X = 6.5; } 
  else { S = 6.0; X = 8.0; }
  const finalTargetStrength = Math.max(fck + (1.65 * S), fck + X);

  // 3. WATER-CEMENT RATIO (Manual vs Auto)
  let maxWC_Durability = 0.55; 
  if (exposure === "Moderate") maxWC_Durability = 0.50;
  if (exposure === "Severe" || exposure === "VerySevere") maxWC_Durability = 0.45;
  if (exposure === "Extreme") maxWC_Durability = 0.40;

  let adoptedWC;
  let warningMessage = "";

  if (wcMode === "manual") {
      adoptedWC = parseFloat(document.getElementById("manualWC").value);
      if (adoptedWC > maxWC_Durability) {
          warningMessage = `\n⚠️ ALERT: W/C ${adoptedWC} exceeds IS 456 Limit of ${maxWC_Durability}!`;
      }
  } else {
      const wcIntercepts = { "A": 1.45, "B": 1.55, "C": 1.62, "D": 1.70, "E": 1.78, "F": 1.85 };
      let intercept = wcIntercepts[cementCategory] || 1.62;
      let calculatedWC = intercept - (0.3288 * Math.log(finalTargetStrength));
      adoptedWC = Math.min(calculatedWC, maxWC_Durability);
  }
  if (adoptedWC < 0.25) adoptedWC = 0.25;

  // 4. WATER CONTENT
  let waterMap = { 10: 208, 20: 186, 40: 165 };
  let baseWater = waterMap[maxAggSize] || 186;
  if (slump > 50) baseWater += baseWater * (((slump - 50) / 25) * 0.03);
  let waterReduction = admixtureType === "superplasticizer" ? 0.23 : 0.10; 
  let finalWater = baseWater * (1 - waterReduction);

  // 5. CEMENT CONTENT
  let cementContent = finalWater / adoptedWC;
  let minCementMap = { "Mild": 300, "Moderate": 300, "Severe": 320, "VerySevere": 340, "Extreme": 360 };
  let minCement = minCementMap[exposure] || 300;
  if (cementContent < minCement) {
      cementContent = minCement;
      adoptedWC = finalWater / cementContent;
  }
  if (cementContent > 450) cementContent = 450;

  // 6. AGGREGATE VOLUMES
  let volCAMap = { 10: 0.50, 20: 0.62, 40: 0.71 }; 
  let volCA_Base = volCAMap[maxAggSize] || 0.62;
  if (faZone === 1) volCA_Base -= 0.015;
  if (faZone === 3) volCA_Base += 0.015;
  if (faZone === 4) volCA_Base += 0.030;
  volCA_Base += ((0.50 - adoptedWC) / 0.05) * 0.01;
  if (isPumpable) volCA_Base *= 0.90;
  let volFA_Base = 1 - volCA_Base;

  // 7. VOLUME CALCULATIONS
  let airMap = { 10: 0.015, 20: 0.010, 40: 0.008 };
  let volAir = airMap[maxAggSize] || 0.010; 
  let volCement = cementContent / (sgCement * 1000);
  let volWater = finalWater / 1000;
  let volAdmixture = (cementContent * (plasticizerDosage/100)) / (sgPlasticizer * 1000);
  let volTotalAgg = 1 - (volCement + volWater + volAdmixture + volAir);

  let massCA_SSD = volTotalAgg * volCA_Base * sgCA * 1000;
  let massFA_SSD = volTotalAgg * volFA_Base * sgFA * 1000;

  // 8. FIELD MOISTURE ADJUSTMENTS
  let finalMassFA = massFA_SSD + (mcFA / 100 * massFA_SSD);
  let finalMassCA = massCA_SSD + (mcCA / 100 * massCA_SSD);
  let finalWaterField = finalWater - (((mcFA - absFA)/100 * massFA_SSD) + ((mcCA - absCA)/100 * massCA_SSD));

  // 9. OUTPUT
  document.getElementById("output").innerText = 
`--- DESIGN STIPULATIONS ---
Target Mean Strength: ${finalTargetStrength.toFixed(2)} MPa
W/C Ratio: ${adoptedWC.toFixed(3)} ${warningMessage}

--- FIELD QUANTITIES (kg/m³) ---
Cement:           ${cementContent.toFixed(1)} kg
Water:            ${finalWaterField.toFixed(1)} kg
Fine Aggregate:   ${finalMassFA.toFixed(1)} kg
Coarse Aggregate: ${finalMassCA.toFixed(1)} kg
Admixture:        ${(cementContent * (plasticizerDosage/100)).toFixed(2)} kg

--- PROPORTIONS ---
1 : ${(finalMassFA/cementContent).toFixed(2)} : ${(finalMassCA/cementContent).toFixed(2)}
`;
  document.getElementById("result").style.display = "block";
});
