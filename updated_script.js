document.getElementById("mixForm").addEventListener("submit", function(e) {
  e.preventDefault();

  // ==========================================
  // 1. INPUTS
  // ==========================================
  const fck = parseFloat(document.getElementById("fck").value);
  const slump = parseInt(document.getElementById("slump").value);
  const exposure = document.getElementById("exposure").value;
  const maxAggSize = parseInt(document.getElementById("maxAggSize").value);
  const cementCategory = document.getElementById("cementCategory").value; // e.g., "A", "B", "C"
  
  const pumpableVal = document.getElementById("pumpable").value;
  const isPumpable = pumpableVal === "yes";

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

  // ==========================================
  // 2. TARGET STRENGTH (f'ck) - IS 10262:2019
  // ==========================================
  let S, X; 
  if (fck <= 15) { S = 3.5; X = 5.0; } 
  else if (fck <= 25) { S = 4.0; X = 5.5; } 
  else if (fck <= 55) { S = 5.0; X = 6.5; } 
  else { S = 6.0; X = 8.0; }

  const targetStrength = fck + (1.65 * S); 
  const targetStrengthAlt = fck + X;
  const finalTargetStrength = Math.max(targetStrength, targetStrengthAlt);

  // ==========================================
  // 3. WATER-CEMENT RATIO (IS 10262:2019 Fig 1 Curves)
  // ==========================================
  // Regression constants for Curves A through F
  const wcIntercepts = { "A": 1.45, "B": 1.55, "C": 1.62, "D": 1.70, "E": 1.78, "F": 1.85 };
  let intercept = wcIntercepts[cementCategory] || 1.62;
  
  let calculatedWC = intercept - (0.3288 * Math.log(finalTargetStrength));

  // Durability Limits (IS 456 Table 5)
  let maxWC_Durability = 0.55; 
  if (exposure === "Moderate") maxWC_Durability = 0.50;
  if (exposure === "Severe") maxWC_Durability = 0.45;
  if (exposure === "VerySevere") maxWC_Durability = 0.45;
  if (exposure === "Extreme") maxWC_Durability = 0.40;

  let adoptedWC = Math.min(calculatedWC, maxWC_Durability);
  if (adoptedWC < 0.25) adoptedWC = 0.25;

  // ==========================================
  // 4. WATER CONTENT (IS 10262 Table 3)
  // ==========================================
  let waterMap = { 10: 208, 20: 186, 40: 165 };
  let baseWater = waterMap[maxAggSize] || 186;

  if (slump > 50) {
      let extraSteps = (slump - 50) / 25;
      baseWater = baseWater + (baseWater * (extraSteps * 0.03));
  }

  let waterReduction = admixtureType === "superplasticizer" ? 0.23 : 0.10; 
  let finalWater = baseWater * (1 - waterReduction);

  // ==========================================
  // 5. CEMENT CONTENT & LIMITS
  // ==========================================
  let cementContent = finalWater / adoptedWC;
  let minCementMap = { "Mild": 300, "Moderate": 300, "Severe": 320, "VerySevere": 340, "Extreme": 360 };
  let minCement = minCementMap[exposure] || 300;
  
  if (cementContent < minCement) {
      cementContent = minCement;
      adoptedWC = finalWater / cementContent;
  }
  if (cementContent > 450) {
      cementContent = 450;
      adoptedWC = finalWater / cementContent;
  }

  // ==========================================
  // 6. AGGREGATE PROPORTIONS
  // ==========================================
  let volCAMap_Zone2 = { 10: 0.50, 20: 0.62, 40: 0.71 }; 
  let volCA_Base = volCAMap_Zone2[maxAggSize] || 0.62;

  // Adjustments: Zone, W/C, and Pumpable
  if (faZone === 1) volCA_Base -= 0.015;
  if (faZone === 3) volCA_Base += 0.015;
  if (faZone === 4) volCA_Base += 0.030;
  volCA_Base += ((0.50 - adoptedWC) / 0.05) * 0.01;

  if (isPumpable) volCA_Base *= 0.90;
  let volFA_Base = 1 - volCA_Base;

  // ==========================================
  // 7. VOLUME CALCULATIONS (Dynamic Air)
  // ==========================================
  let volCement = cementContent / (sgCement * 1000);
  let volWater = finalWater / 1000;
  let volAdmixture = (cementContent * (plasticizerDosage/100)) / (sgPlasticizer * 1000);
  
  // Table 3: Air Content based on Aggregate Size
  let airMap = { 10: 0.015, 20: 0.010, 40: 0.008 };
  let volAir = airMap[maxAggSize] || 0.010; 

  let volTotalAgg = 1 - (volCement + volWater + volAdmixture + volAir);
  let massCA_SSD = volTotalAgg * volCA_Base * sgCA * 1000;
  let massFA_SSD = volTotalAgg * volFA_Base * sgFA * 1000;

  // ==========================================
  // 8. FIELD MOISTURE ADJUSTMENTS
  // ==========================================
  let freeWaterFA = (mcFA - absFA) / 100 * massFA_SSD;
  let freeWaterCA = (mcCA - absCA) / 100 * massCA_SSD;
  
  let finalMassFA = massFA_SSD + (mcFA / 100 * massFA_SSD);
  let finalMassCA = massCA_SSD + (mcCA / 100 * massCA_SSD);
  let finalWaterField = finalWater - (freeWaterFA + freeWaterCA);

  // ==========================================
  // 9. OUTPUT
  // ==========================================
  document.getElementById("output").innerText = 
`--- DESIGN STIPULATIONS ---
Target Mean Strength: ${finalTargetStrength.toFixed(2)} MPa
W/C Ratio (Adopted): ${adoptedWC.toFixed(3)}
Air Content (Table 3): ${(volAir * 100).toFixed(1)}%

--- FIELD QUANTITIES (kg/m³) ---
Cement:           ${cementContent.toFixed(1)} kg
Water:            ${finalWaterField.toFixed(1)} kg
Fine Aggregate:   ${finalMassFA.toFixed(1)} kg
Coarse Aggregate: ${finalMassCA.toFixed(1)} kg
Admixture:        ${(cementContent * (plasticizerDosage/100)).toFixed(2)} kg

--- MIX PROPORTIONS ---
1 : ${(finalMassFA/cementContent).toFixed(2)} : ${(finalMassCA/cementContent).toFixed(2)}
`;
  document.getElementById("result").style.display = "block";
});
