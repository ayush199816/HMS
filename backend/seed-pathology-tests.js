const mongoose = require('mongoose');
const PathologyTest = require('./models/PathologyTest');
const PathologyProvider = require('./models/PathologyProvider');
const Hospital = require('./models/Hospital');
const User = require('./models/User');

// Comprehensive test data from the provided list
const pathologyTestsData = {
  'Hematology': [
    { name: 'Hemoglobin', code: 'HGB', normalRange: '12-16 g/dL', units: 'g/dL' },
    { name: 'TLC', code: 'TLC', normalRange: '4000-11000 cells/cu.mm', units: 'cells/cu.mm' },
    { name: 'DLC', code: 'DLC', normalRange: 'Neutrophils 40-70%, Lymphocytes 20-40%', units: '%' },
    { name: 'RBC Count', code: 'RBC', normalRange: '4.5-5.5 million/cu.mm', units: 'million/cu.mm' },
    { name: 'Eosinophil Count', code: 'EOS', normalRange: '1-6%', units: '%' },
    { name: 'Platelet Count', code: 'PLT', normalRange: '1.5-4.5 lakh/cu.mm', units: 'lakh/cu.mm' },
    { name: 'BT', code: 'BT', normalRange: '1-3 minutes', units: 'minutes' },
    { name: 'CT', code: 'CT', normalRange: '3-8 minutes', units: 'minutes' },
    { name: 'ESR', code: 'ESR', normalRange: '0-15 mm/hr', units: 'mm/hr' },
    { name: 'PCV/Hematocrit', code: 'PCV', normalRange: '40-50%', units: '%' },
    { name: 'Complete Hemogram', code: 'CBC', normalRange: 'Varies by parameter', units: 'Multiple' },
    { name: 'PBF for Type of Anemia', code: 'PBF', normalRange: 'Normal morphology', units: 'Qualitative' },
    { name: 'Blood Grouping', code: 'BG', normalRange: 'A/B/O/AB + Rh factor', units: 'Blood group' },
    { name: 'PT, INR', code: 'PT', normalRange: '11-15 seconds, INR 0.8-1.2', units: 'seconds' },
    { name: 'APTT', code: 'APTT', normalRange: '25-35 seconds', units: 'seconds' },
    { name: 'G6PD', code: 'G6PD', normalRange: 'Normal activity', units: 'U/g Hb' },
    { name: 'Reticulocyte count', code: 'RET', normalRange: '0.5-2.5%', units: '%' },
    { name: 'd-Dimer', code: 'DIMER', normalRange: '<0.5 mcg/mL', units: 'mcg/mL' },
    { name: 'Screening Test for hemoglobinopathies', code: 'HEMO', normalRange: 'Normal pattern', units: 'Qualitative' }
  ],
  'Urine Examination': [
    { name: 'Microscopic Exam', code: 'URINE_MICRO', normalRange: '0-5 RBC, 0-5 WBC', units: '/hpf' },
    { name: 'Urine Sugar', code: 'URINE_SUGAR', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'Urine ALBUMIN', code: 'URINE_ALB', normalRange: 'Negative/Trace', units: 'Qualitative' },
    { name: 'Bile Salts', code: 'BILE_SALTS', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'Bile Pigments', code: 'BILE_PIG', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'Urinary pH', code: 'URINE_PH', normalRange: '4.5-8.0', units: 'pH' },
    { name: 'Urine for RBC', code: 'URINE_RBC', normalRange: '0-2/hpf', units: '/hpf' },
    { name: 'Urine for Ketone Bodies', code: 'URINE_KET', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'Urine for Pregnancy', code: 'URINE_PREG', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'Urine for Bilirubin', code: 'URINE_BIL', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'Urine Specific Gravity', code: 'URINE_SG', normalRange: '1.003-1.035', units: 'SG' },
    { name: 'Urine Urobilinogen', code: 'URINE_URO', normalRange: '<1 mg/dL', units: 'mg/dL' },
    { name: 'Urine Leucocytes', code: 'URINE_LEU', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'Urine Nitrite', code: 'URINE_NIT', normalRange: 'Negative', units: 'Qualitative' }
  ],
  'Semen Analysis': [
    { name: 'Semen Analysis', code: 'SEMAN', normalRange: 'Volume 1.5-5 mL, Count 15-200 million/mL', units: 'Multiple' },
    { name: 'Semen Volume', code: 'SEMAN_VOL', normalRange: '1.5-5 mL', units: 'mL' },
    { name: 'Sperm Count', code: 'SPERM_CNT', normalRange: '15-200 million/mL', units: 'million/mL' },
    { name: 'Sperm Motility', code: 'SPERM_MOT', normalRange: '>40% progressive', units: '%' },
    { name: 'Sperm Morphology', code: 'SPERM_MORPH', normalRange: '>4% normal forms', units: '%' }
  ],
  'Cytopathology': [
    { name: 'FNAC', code: 'FNAC', normalRange: 'Benign/Malignant', units: 'Qualitative' },
    { name: 'PAP Smear', code: 'PAP', normalRange: 'Negative for intraepithelial lesion', units: 'Qualitative' }
  ],
  'Body Fluids': [
    { name: 'CSF Microscopy', code: 'CSF', normalRange: 'Clear, 0-5 WBC', units: 'Qualitative' },
    { name: 'Synovial Fluid Analysis', code: 'SYNOVIAL', normalRange: 'Clear, <200 WBC', units: 'Qualitative' },
    { name: 'Pleural Fluid Analysis', code: 'PLEURAL', normalRange: 'Clear, <1000 WBC', units: 'Qualitative' },
    { name: 'Ascitic Fluid Analysis', code: 'ASCITIC', normalRange: 'Clear, <500 WBC', units: 'Qualitative' }
  ],
  'Histopathology': [
    { name: 'Whole Specimens/Biopsy Specimens', code: 'BIOPSY', normalRange: 'Benign/Malignant', units: 'Qualitative' },
    { name: 'Postmortem specimens', code: 'POSTMORTEM', normalRange: 'Cause of death', units: 'Qualitative' }
  ],
  'Microbiology': [
    { name: 'Bacterial Culture & Antibiotic sensitivity', code: 'CULTURE', normalRange: 'No growth/Sensitive/Resistant', units: 'Qualitative' },
    { name: 'Tuberculosis Culture', code: 'TB_CULTURE', normalRange: 'No growth detected', units: 'Qualitative' },
    { name: 'Fungal culture', code: 'FUNGAL', normalRange: 'No fungal growth', units: 'Qualitative' },
    { name: 'Gram\'s stain', code: 'GRAM', normalRange: 'No organisms seen', units: 'Qualitative' },
    { name: 'KOH mount', code: 'KOH', normalRange: 'No fungal elements', units: 'Qualitative' },
    { name: 'ZN staining', code: 'ZN', normalRange: 'No AFB seen', units: 'Qualitative' },
    { name: 'PBF for Malarial Parasite', code: 'MALARIA', normalRange: 'No parasites seen', units: 'Qualitative' },
    { name: 'VDRL/RPR/TPHA', code: 'VDRL', normalRange: 'Non-reactive', units: 'Qualitative' },
    { name: 'CRP', code: 'CRP', normalRange: '<3 mg/L', units: 'mg/L' },
    { name: 'Rheumatoid Factor(RA)', code: 'RA', normalRange: '<20 IU/mL', units: 'IU/mL' },
    { name: 'ASO', code: 'ASO', normalRange: '<200 IU/mL', units: 'IU/mL' },
    { name: 'WIDAL', code: 'WIDAL', normalRange: 'O <1:80, H <1:160', units: 'Titer' },
    { name: 'Malaria Ag card', code: 'MAL_AG', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'Dengue serology', code: 'DENGUE', normalRange: 'IgM <1.10, IgG <1.10', units: 'Index' },
    { name: 'HCV Card', code: 'HCV_CARD', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'HCV ELISA', code: 'HCV_ELISA', normalRange: 'Non-reactive', units: 'Qualitative' },
    { name: 'HBsAg ELISA', code: 'HBsAg_ELISA', normalRange: 'Non-reactive', units: 'Qualitative' },
    { name: 'HBsAg CARD', code: 'HBsAg_CARD', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'HIV card', code: 'HIV_CARD', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'Stool For Ova/Cyst', code: 'STOOL', normalRange: 'No ova/cyst seen', units: 'Qualitative' },
    { name: 'Stool For Occult blood', code: 'STOOL_OB', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'IgE', code: 'IGE', normalRange: '<150 IU/mL', units: 'IU/mL' },
    { name: 'IgG', code: 'IGG', normalRange: '700-1600 mg/dL', units: 'mg/dL' },
    { name: 'IgM', code: 'IGM', normalRange: '40-230 mg/dL', units: 'mg/dL' },
    { name: 'IgA', code: 'IGA', normalRange: '70-400 mg/dL', units: 'mg/dL' },
    { name: 'Serum ferritin test', code: 'FERRITIN', normalRange: '12-150 ng/mL', units: 'ng/mL' },
    { name: 'Serum Ceruloplasmin levels', code: 'CERULO', normalRange: '20-35 mg/dL', units: 'mg/dL' },
    { name: 'ASO level', code: 'ASO_LEVEL', normalRange: '<200 IU/mL', units: 'IU/mL' },
    { name: 'C3 Level', code: 'C3', normalRange: '90-180 mg/dL', units: 'mg/dL' },
    { name: 'IL6', code: 'IL6', normalRange: '<7 pg/mL', units: 'pg/mL' },
    { name: 'SCRUB TYPHUS', code: 'SCRUB', normalRange: 'Negative', units: 'Qualitative' },
    { name: 'RTPCR FOR COVID 19', code: 'COVID', normalRange: 'Not detected', units: 'Qualitative' }
  ],
  'Biochemistry': [
    { name: 'B. Glucose', code: 'GLUC', normalRange: '70-110 mg/dL', units: 'mg/dL' },
    { name: 'B. urea', code: 'UREA', normalRange: '15-40 mg/dL', units: 'mg/dL' },
    { name: 'S. Creatinine', code: 'CREAT', normalRange: '0.6-1.2 mg/dL', units: 'mg/dL' },
    { name: 'S. Bilirubin Total', code: 'BIL_TOT', normalRange: '0.3-1.2 mg/dL', units: 'mg/dL' },
    { name: 'T. Protein', code: 'PROT_TOT', normalRange: '6.0-8.5 g/dL', units: 'g/dL' },
    { name: 'S. Albumin', code: 'ALB', normalRange: '3.5-5.5 g/dL', units: 'g/dL' },
    { name: 'S. Calcium', code: 'CAL', normalRange: '8.5-10.5 mg/dL', units: 'mg/dL' },
    { name: 'S. Phosphorus', code: 'PHOS', normalRange: '2.5-4.5 mg/dL', units: 'mg/dL' },
    { name: 'S. Uric Acid', code: 'URIC', normalRange: '3.5-7.0 mg/dL', units: 'mg/dL' },
    { name: 'T. Cholesterol', code: 'CHOL_TOT', normalRange: '<200 mg/dL', units: 'mg/dL' },
    { name: 'Triglyceride', code: 'TG', normalRange: '<150 mg/dL', units: 'mg/dL' },
    { name: 'HDL Cholesterol', code: 'HDL', normalRange: '>40 mg/dL', units: 'mg/dL' },
    { name: 'Serum Sodium', code: 'NA', normalRange: '135-145 mEq/L', units: 'mEq/L' },
    { name: 'Serum Potassium', code: 'K', normalRange: '3.5-5.0 mEq/L', units: 'mEq/L' },
    { name: 'Serum Chloride', code: 'CL', normalRange: '98-106 mEq/L', units: 'mEq/L' },
    { name: 'Serum Lithium', code: 'LI', normalRange: '0.6-1.2 mEq/L', units: 'mEq/L' },
    { name: 'Ionized Calcium', code: 'CAL_ION', normalRange: '4.4-5.3 mg/dL', units: 'mg/dL' },
    { name: 'S. SGOT', code: 'SGOT', normalRange: '<40 U/L', units: 'U/L' },
    { name: 'S. SGPT', code: 'SGPT', normalRange: '<40 U/L', units: 'U/L' },
    { name: 'ALP', code: 'ALP', normalRange: '40-129 U/L', units: 'U/L' },
    { name: 'Amylase', code: 'AMY', normalRange: '25-125 U/L', units: 'U/L' },
    { name: 'CPK-MB', code: 'CPK_MB', normalRange: '<25 U/L', units: 'U/L' },
    { name: 'Iron', code: 'IRON', normalRange: '60-170 mcg/dL', units: 'mcg/dL' },
    { name: 'Magnesium', code: 'MG', normalRange: '1.7-2.2 mg/dL', units: 'mg/dL' },
    { name: 'PCT', code: 'PCT', normalRange: '<0.1 ng/mL', units: 'ng/mL' },
    { name: 'GGT', code: 'GGT', normalRange: '<50 U/L', units: 'U/L' },
    { name: 'S. L.D.L. Cholesterol', code: 'LDL', normalRange: '<100 mg/dL', units: 'mg/dL' },
    { name: 'L.D.H.', code: 'LDH', normalRange: '140-280 U/L', units: 'U/L' },
    { name: 'TPUC', code: 'TPUC', normalRange: '0-20 mg/dL', units: 'mg/dL' },
    { name: 'UIBC', code: 'UIBC', normalRange: '140-370 mcg/dL', units: 'mcg/dL' },
    { name: 'HbA1C', code: 'HBA1C', normalRange: '<6.5%', units: '%' },
    { name: 'TSH', code: 'TSH', normalRange: '0.4-4.0 mIU/L', units: 'mIU/L' },
    { name: 'fT3', code: 'FT3', normalRange: '2.3-4.2 pg/mL', units: 'pg/mL' },
    { name: 'fT4', code: 'FT4', normalRange: '0.8-1.8 ng/dL', units: 'ng/dL' },
    { name: 'Anti - TPO Antibodies', code: 'TPO', normalRange: '<35 IU/mL', units: 'IU/mL' },
    { name: 'hs-CRP', code: 'HSCRP', normalRange: '<3 mg/L', units: 'mg/L' },
    { name: 'CRP', code: 'CRP_Q', normalRange: '<10 mg/L', units: 'mg/L' },
    { name: 'Transferrin', code: 'TRANS', normalRange: '200-400 mg/dL', units: 'mg/dL' }
  ],
  'Blood Bank': [
    { name: 'HIV, HBsAg, HCV, Syphilis, Malaria Parasite', code: 'BB_SCREEN', normalRange: 'Non-reactive', units: 'Qualitative' },
    { name: 'Coombs Crossmatch', code: 'CROSS', normalRange: 'Compatible', units: 'Qualitative' },
    { name: 'Blood Grouping', code: 'BB_BG', normalRange: 'A/B/O/AB + Rh factor', units: 'Blood group' },
    { name: 'Component Preparation', code: 'COMP', normalRange: 'N/A', units: 'N/A' },
    { name: 'Apheresis', code: 'APHERESIS', normalRange: 'N/A', units: 'N/A' }
  ]
};

async function seedPathologyTests() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hms');
    console.log('Connected to MongoDB');

    // Get or create a default hospital
    let hospital = await Hospital.findOne();
    if (!hospital) {
      hospital = new Hospital({
        name: 'Default Hospital',
        email: 'hospital@example.com',
        phone: '1234567890',
        address: 'Default Address',
        city: 'Default City',
        state: 'Default State',
        pincode: '123456',
        registrationNumber: 'REG123456',
        isActive: true
      });
      await hospital.save();
      console.log('Created default hospital');
    }

    // Get or create a default user (pathologist)
    let user = await User.findOne({ role: 'pathologist' });
    if (!user) {
      user = new User({
        name: 'Default Pathologist',
        email: 'pathologist@example.com',
        phone: '1234567890',
        role: 'pathologist',
        hospitalId: hospital._id,
        isActive: true
      });
      await user.save();
      console.log('Created default pathologist user');
    }

    // Get or create a default pathology provider
    let provider = await PathologyProvider.findOne({ hospitalId: hospital._id });
    if (!provider) {
      provider = new PathologyProvider({
        name: 'In-house Laboratory',
        code: 'LAB001',
        contactPerson: 'Lab Manager',
        phone: '1234567890',
        email: 'lab@hospital.com',
        address: 'Hospital Lab',
        city: hospital.city,
        state: hospital.state,
        pincode: hospital.pincode,
        licenseNumber: 'LAB123456',
        accreditation: 'NABL',
        specialization: ['Hematology', 'Biochemistry', 'Microbiology'],
        turnaroundTime: 24,
        samplePickup: false,
        homeCollection: true,
        emergencyServices: true,
        hospitalId: hospital._id,
        createdBy: user._id
      });
      await provider.save();
      console.log('Created default pathology provider');
    }

    // Clear existing tests for this hospital
    await PathologyTest.deleteMany({ hospitalId: hospital._id });
    console.log('Cleared existing pathology tests');

    // Add all tests
    const testsToAdd = [];
    
    Object.entries(pathologyTestsData).forEach(([category, testList]) => {
      testList.forEach(test => {
        testsToAdd.push({
          name: test.name,
          code: test.code,
          category: category,
          description: `${test.name} - ${category} test`,
          sampleType: getDefaultSampleType(category),
          preparationInstructions: getPreparationInstructions(category, test.name),
          normalRange: test.normalRange,
          units: test.units,
          pricing: {
            costPrice: getDefaultCostPrice(category, test.name),
            sellingPrice: getDefaultSellingPrice(category, test.name),
            pricingMethod: 'direct'
          },
          provider: provider._id,
          hospitalId: hospital._id,
          createdBy: user._id
        });
      });
    });

    // Insert all tests
    const insertedTests = await PathologyTest.insertMany(testsToAdd);
    console.log(`Successfully added ${insertedTests.length} pathology tests`);

    // Print summary
    const summary = {};
    Object.keys(pathologyTestsData).forEach(category => {
      summary[category] = pathologyTestsData[category].length;
    });
    
    console.log('\n=== Test Summary ===');
    Object.entries(summary).forEach(([category, count]) => {
      console.log(`${category}: ${count} tests`);
    });
    console.log(`Total: ${Object.values(summary).reduce((a, b) => a + b, 0)} tests\n`);

    console.log('Pathology test seeding completed successfully!');
    
  } catch (error) {
    console.error('Error seeding pathology tests:', error);
  } finally {
    await mongoose.disconnect();
  }
}

function getDefaultSampleType(category) {
  switch (category) {
    case 'Hematology':
    case 'Biochemistry':
    case 'Blood Bank':
      return 'Blood';
    case 'Urine Examination':
      return 'Urine';
    case 'Semen Analysis':
      return 'Other';
    case 'Histopathology':
    case 'Cytopathology':
      return 'Tissue';
    case 'Microbiology':
      return 'Swab';
    case 'Body Fluids':
      return 'CSF';
    default:
      return 'Blood';
  }
}

function getPreparationInstructions(category, testName) {
  const instructions = {
    'Hematology': 'Fasting not required. Avoid heavy exercise 24 hours before test.',
    'Biochemistry': '10-12 hours fasting required. Drink water only.',
    'Urine Examination': 'Clean catch midstream urine sample. First morning sample preferred.',
    'Blood Bank': 'No special preparation required.',
    'Microbiology': 'No antibiotics for 48 hours before sample collection.',
    default: 'Follow standard sample collection procedures.'
  };
  
  return instructions[category] || instructions.default;
}

function getDefaultCostPrice(category, testName) {
  const basePrices = {
    'Hematology': 50,
    'Biochemistry': 80,
    'Urine Examination': 30,
    'Blood Bank': 100,
    'Microbiology': 120,
    'Semen Analysis': 200,
    'Cytopathology': 150,
    'Body Fluids': 100,
    'Histopathology': 300
  };
  
  return basePrices[category] || 100;
}

function getDefaultSellingPrice(category, testName) {
  const costPrice = getDefaultCostPrice(category, testName);
  return Math.round(costPrice * 1.5); // 50% markup
}

// Run the seeding function
if (require.main === module) {
  seedPathologyTests();
}

module.exports = seedPathologyTests;
