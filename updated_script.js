document.getElementById("mixForm").addEventListener("submit", function(e) {
  e.preventDefault();

  // ==========================================
  // 1. INPUTS
  // ==========================================
  const fck = parseFloat(document.getElementById("fck").value);
  const slump = parseInt(document.getElementById("slump").value);
  const exposure = document.getElementById("exposure").value;
  const maxAggSize = parseInt(document.getElementById("maxAggSize").value);
  
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
  
  // Default chemical dosage (can be exposed as input if needed)
  const plasticizerDosage = 1.0; // 1% by weight of cement

  // ==========================================
  // 2. TARGET STRENGTH (f'ck) - IS 10262:2019
  // ==========================================
  let S, X; // Standard Deviation (S) and Factor (X)
  
  // Table 1 & 2 values
  if (fck <= 15) { 
      S = 3.5; X = 5.0;  // M10 - M15
  } else if (fck <= 25) { 
      S = 4.0; X = 5.5;  // M20 - M25
  } else if (fck <= 55) { 
      S = 5.0; X = 6.5;  // M30 - M55
  } else { 
      S = 6.0; X = 8.0;  // M60+
  }

  // Calculate Target Mean Strength
  const targetStrength = fck + (1.65 * S); 
  const targetStrengthAlt = fck + X;
  const finalTargetStrength = Math.max(targetStrength, targetStrengthAlt);

  // ==========================================
  // 3. WATER-CEMENT RATIO (Custom Curve)
  // ==========================================
  // Derived from your CSV file: R² = 0.998
  // Formula: W/C = 1.6175 - 0.3288 * ln(Target Strength)
  
  let calculatedWC = 1.6175 - (0.3288 * Math.log(finalTargetStrength));

  // -- LIMIT CHECK: Durability (IS 456 Table 5) --
  let maxWC_Durability = 0.55; 
  if (exposure === "Moderate") maxWC_Durability = 0.50;
  if (exposure === "Severe") maxWC_Durability = 0.45;
  if (exposure === "VerySevere") maxWC_Durability = 0.45;
  if (exposure === "Extreme") maxWC_Durability = 0.40;

  // Adopt the lower value (Safety first)
  let adoptedWC = Math.min(calculatedWC, maxWC_Durability);

  // Absolute safety floor (Concrete rarely valid below 0.25)
  if (adoptedWC < 0.25) adoptedWC = 0.25;

  // ==========================================
  // 4. WATER CONTENT
  // ==========================================
  // IS 10262 Table 3 (Base values for 50mm slump)
  let waterMap = { 10: 208, 20: 186, 40: 165 };
  let baseWater = waterMap[maxAggSize] || 186;

  // Slump Adjustment: +3% water for every 25mm slump over 50mm
  if (slump > 50) {
      let extraSteps = (slump - 50) / 25;
      baseWater = baseWater + (baseWater * (extraSteps * 0.03));
  }

  // Admixture Adjustment: Reduce water
  // PPC/Plasticizer ~20-30% reduction allowed depending on type
  let waterReduction = admixtureType === "superplasticizer" ? 0.23 : 0.10; // 23% for SP, 10% for Plasticizer
  let finalWater = baseWater * (1 - waterReduction);

  // ==========================================
  // 5. CEMENT CONTENT
  // ==========================================
  let cementContent = finalWater / adoptedWC;

  // -- LIMIT CHECK: Min Cement (IS 456 Table 5) --
  let minCementMap = { 
      "Mild": 300, "Moderate": 300, "Severe": 320, 
      "VerySevere": 340, "Extreme": 360 
  };
  let minCement = minCementMap[exposure] || 300;
  
  // -- LIMIT CHECK: Max Cement (IS 456) --
  const maxCement = 450; 

  // Apply Min/Max limits
  if (cementContent < minCement) {
      cementContent = minCement;
      // If we increase cement, we must lower W/C to keep water same, or keep W/C and increase water?
      // Usually, we keep water fixed and lower W/C.
      adoptedWC = finalWater / cementContent;
  }
  
  if (cementContent > maxCement) {
      cementContent = maxCement;
      // If capped at 450, we might lose strength, but IS 456 prohibits >450 to prevent cracking.
      // We warn the user in a real app, but here we just cap it.
      adoptedWC = finalWater / cementContent;
  }

  // ==========================================
  // 6. AGGREGATE PROPORTIONS (Volume Method)
  // ==========================================
  // IS 10262 Table 5 (Volume of CA for Zone II FA, W/C 0.50)
  let volCAMap_Zone2 = { 10: 0.50, 20: 0.62, 40: 0.71 }; 
  let volCA_Base = volCAMap_Zone2[maxAggSize] || 0.62;

  // Zone Adjustment
  // Zone 1: -0.015, Zone 2: 0, Zone 3: +0.015, Zone 4: +0.030
  if (faZone === 1) volCA_Base -= 0.015;
  if (faZone === 3) volCA_Base += 0.015;
  if (faZone === 4) volCA_Base += 0.030;

  // W/C Adjustment (Table 5 rule: +/- 0.01 CA for every -/+ 0.05 W/C)
  // Lower W/C = Higher CA volume
  let wcDiff = 0.50 - adoptedWC;
  let adjustment = (wcDiff / 0.05) * 0.01;
  volCA_Base += adjustment;

  // Pumpable Adjustment (reduce CA by 10% for smooth flow)
  if (isPumpable) {
      volCA_Base = volCA_Base * 0.90;
  }

  // Ensure VolCA doesn't exceed 1.0 (sanity check)
  if (volCA_Base > 0.95) volCA_Base = 0.95;

  let volFA_Base = 1 - volCA_Base;

  // ==========================================
 // ==========================================
  // 7. MIX CALCULATIONS (Refined per IS 10262:2019)
  // ==========================================
  let volCement = cementContent / (sgCement * 1000);
  let volWater = finalWater / 1000;
  let volAdmixture = (cementContent * (plasticizerDosage/100)) / (sgPlasticizer * 1000);
  
  // Table 3: Refined Air Content based on Aggregate Size
  let airMap = { 10: 0.015, 20: 0.010, 40: 0.008 };
  let volAir = airMap[maxAggSize] || 0.010; 

  let volTotalAgg = 1 - (volCement + volWater + volAdmixture + volAir);

  // SSD Masses (Theoretical)
  let massCA_SSD = volTotalAgg * volCA_Base * sgCA * 1000;
  let massFA_SSD = volTotalAgg * volFA_Base * sgFA * 1000;

  // ==========================================
  // 8. FIELD ADJUSTMENTS (Moisture & Absorption)
  // ==========================================
  // Formula: Free Water = Moisture Content - Absorption
  let freeWaterFA = (mcFA - absFA) / 100 * massFA_SSD;
  let freeWaterCA = (mcCA - absCA) / 100 * massCA_SSD;
  let totalFreeWater = freeWaterFA + freeWaterCA;

  // Adjusted Weights for the Batch
  let finalMassFA = massFA_SSD + (mcFA / 100 * massFA_SSD);
  let finalMassCA = massCA_SSD + (mcCA / 100 * massCA_SSD);
  let finalWaterField = finalWater - totalFreeWater;

  // ==========================================
  // 9. FINAL OUTPUT
  // ==========================================
  const outputText = 
`--- DESIGN STIPULATIONS ---
Target Mean Strength: ${finalTargetStrength.toFixed(2)} MPa
W/C Ratio: ${adoptedWC.toFixed(3)}
Entrapped Air: ${(volAir * 100).toFixed(1)}%

--- QUANTITIES (Field Adjusted kg/m³) ---
Cement:           ${cementContent.toFixed(1)} kg
Water:            ${finalWaterField.toFixed(1)} kg (Adjusted for moisture)
Fine Aggregate:   ${finalMassFA.toFixed(1)} kg
Coarse Aggregate: ${finalMassCA.toFixed(1)} kg
Admixture:        ${(cementContent * (plasticizerDosage/100)).toFixed(2)} kg

--- FINAL RATIOS (By Weight) ---
1 : ${(finalMassFA/cementContent).toFixed(2)} : ${(finalMassCA/cementContent).toFixed(2)}
`;

  document.getElementById("output").innerText = outputText;
