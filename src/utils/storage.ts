import { SavedStudyTopic, StudyNotes, SummaryData, QuizData } from '../types/study';

const STORAGE_KEY = 'ai_study_assistant_topics_v1';

export const STARTER_TOPICS: SavedStudyTopic[] = [
  {
    id: 'starter-crispr',
    topic: 'CRISPR-Cas9 & Gene Editing',
    level: 'Undergraduate',
    updatedAt: Date.now() - 3600000 * 5,
    notes: {
      id: 'notes-crispr',
      topic: 'CRISPR-Cas9 & Gene Editing',
      title: 'Molecular Architecture & Mechanisms of CRISPR-Cas9',
      level: 'Undergraduate',
      estimatedReadTime: '6 min read',
      summaryBrief: 'CRISPR-Cas9 is an adaptive bacterial immune defense mechanism adapted into a versatile molecular scalpel for targeted genomic modification across eukaryotes.',
      prerequisites: ['Central Dogma (DNA to RNA to Protein)', 'Base-pairing rules (Watson-Crick)', 'Double-strand breaks and cellular repair pathways'],
      sections: [
        {
          heading: '1. Biological Origins: Bacterial Adaptive Immunity',
          subheading: 'How bacteria remember and destroy viral phage invaders',
          content: 'In nature, CRISPR (Clustered Regularly Interspaced Short Palindromic Repeats) functions as an adaptive immune archive in prokaryotes.\n\nWhen a bacteriophage infects a bacterium, Cas proteins capture short fragments of viral DNA (**protospacers**) and incorporate them into the CRISPR genomic locus between repeat sequences.\n\nUpon reinfection, this locus is transcribed into precursor crRNA and processed into mature guide complexes that survey incoming foreign nucleic acids for complementary sequences.',
          keyTakeaway: 'CRISPR evolved as a biological memory bank against predatory phages.',
        },
        {
          heading: '2. The Two-Component Precision Machine: Cas9 and Guide RNA',
          subheading: 'Engineering single guide RNA (sgRNA) for programmatic targeting',
          content: 'In the engineered laboratory system developed by Doudna and Charpentier:\n\n- **Cas9 Endonuclease**: The catalytic enzyme containing two distinct cutting domains (**RuvC** and **HNH**), each cleaving one strand of the DNA double helix.\n- **sgRNA (single guide RNA)**: A synthetic chimera combining the target-specifying crRNA (20 nucleotides) with the structural tracrRNA scaffold that recruits Cas9.\n- **PAM Requirement (NGG)**: Cas9 will strictly NOT bind or cleave unless the target DNA sequence is directly followed by a Protospacer Adjacent Motif (usually 5\'-NGG-3\' for S. pyogenes). The PAM acts as a molecular "safe switch" preventing bacteria from cleaving their own CRISPR arrays.',
          keyTakeaway: 'Binding requires both 20-bp guide RNA complementarity and an adjacent 5\'-NGG-3\' PAM sequence.',
        },
        {
          heading: '3. Cleavage and Cellular Repair Pathways: NHEJ vs HDR',
          subheading: 'How cells repair double-strand breaks determines the genetic outcome',
          content: 'Cas9 does not technically "edit" DNA on its own; it acts purely as a targeted pair of molecular scissors introducing a precise double-strand break (DSB) 3-4 base pairs upstream of the PAM. The host cell\'s endogenous repair machinery determines the outcome:\n\n1. **NHEJ (Non-Homologous End Joining)**: An error-prone ligation mechanism that frequently introduces small insertions or deletions (**indels**). This causes frameshift mutations, making it ideal for **gene knockout** studies.\n2. **HDR (Homology-Directed Repair)**: A high-fidelity pathway active during S/G2 phases of the cell cycle. When provided with an exogenous donor template containing homologous flanking arms, cells can copy exact desired sequences into the break site for **precise gene knock-in** or correction.',
          keyTakeaway: 'NHEJ causes random knockout indels, while HDR enables exact sequence replacement when a template is supplied.',
        },
        {
          heading: '4. Next-Generation Variants: Base and Prime Editing',
          subheading: 'Transcending double-strand breaks for higher therapeutic precision',
          content: 'Standard Cas9 introduces double-strand breaks which can trigger chromosomal rearrangements, p53 DNA-damage responses, or off-target cuts. Modern innovations include:\n\n- **Dead Cas9 (dCas9)**: Catalytically inactive Cas9 fused to transcriptional activators (CRISPRa) or repressors (CRISPRi) to modulate gene expression without touching sequence.\n- **Base Editors**: dCas9 or nickase fused to a deaminase enzyme (e.g. cytidine or adenine deaminase), converting C·G to T·A or A·T to G·C without creating DSBs.\n- **Prime Editing**: Cas9 nickase fused to engineered reverse transcriptase, writing new genetic sequences directly from an extended pegRNA.',
          keyTakeaway: 'Modern editing minimizes double-strand break toxicity through enzymatically coupled base and prime editing.',
        },
      ],
      keyTerms: [
        { term: 'sgRNA', definition: 'Single guide RNA; synthetic fusion of crRNA and tracrRNA guiding Cas9 to the genomic address.', exampleOrFormula: '20-nucleotide guide sequence + structural loop' },
        { term: 'PAM (Protospacer Adjacent Motif)', definition: 'Short 2-6 bp sequence directly downstream of target DNA required for Cas9 recognition.', exampleOrFormula: '5\'-NGG-3\' for Streptococcus pyogenes' },
        { term: 'Indel', definition: 'Insertion or deletion mutation created by error-prone NHEJ repair.', exampleOrFormula: 'Causes frameshifts to disrupt coding reading frames' },
      ],
      misconceptions: [
        { myth: 'Cas9 inserts the new genes directly by itself.', reality: 'Cas9 only cuts DNA; cellular repair enzymes (HDR) integrate new donor DNA templates.' },
        { myth: 'CRISPR can target any random sequence in the entire genome without restriction.', reality: 'Cas9 strictly requires a neighboring PAM motif (5\'-NGG-3\') adjacent to the target.' },
      ],
      examTips: [
        'Always mention the two distinct nuclease domains (HNH and RuvC) and which strand each cuts.',
        'Distinguish clearly between NHEJ (knockout, indel-prone) and HDR (knock-in, template-dependent, cell-cycle restricted).',
      ],
      selfTestQuestions: [
        'Why doesn\'t Cas9 destroy the bacterium\'s own CRISPR array locus?',
        'What would happen if you mutate the catalytic residues of both HNH and RuvC domains?',
        'How does the cell cycle state impact whether NHEJ or HDR predominates?',
      ],
      createdAt: Date.now() - 3600000 * 5,
    },
    summary: {
      title: 'CRISPR-Cas9 Revision Brief',
      executiveSummary: 'CRISPR-Cas9 is an engineered RNA-guided endonuclease system adapted from bacterial defense. By pairing a synthetic 20-nucleotide sgRNA with the Cas9 enzyme, researchers introduce site-specific double-strand breaks immediately upstream of a 5\'-NGG PAM site. Cellular resolution via NHEJ disrupts genes through frameshift indels, while HDR incorporates exogenous donor templates for precise gene replacement.',
      keyBullets: [
        'Natural role: Prokaryotic adaptive immunity against foreign bacteriophages.',
        'Components: Cas9 endonuclease protein + sgRNA (crRNA + tracrRNA chimera).',
        'Targeting constraint: Strictly requires a 5\'-NGG PAM motif right after the target sequence.',
        'Cleavage mechanism: Dual nuclease domains (RuvC & HNH) generate a double-strand break.',
        'NHEJ pathway: Error-prone end-joining leading to frameshifts and gene knockouts.',
        'HDR pathway: High-fidelity template-directed repair for targeted knock-ins.',
        'Modern iterations: dCas9 epigenetic modulation, base editing, and prime editing bypass DSB hazards.',
      ],
      flashcards: [
        { id: 'fc-1', front: 'What is the role of the PAM sequence in CRISPR-Cas9?', back: 'It is a 5\'-NGG-3\' motif adjacent to the target site. Cas9 requires it for binding and cleavage, preventing bacteria from cutting their own spacer array.', category: 'Mechanism' },
        { id: 'fc-2', front: 'Compare NHEJ and HDR repair outcomes following Cas9 cleavage.', back: 'NHEJ is error-prone and causes indel mutations (gene knockouts); HDR uses a homologous donor template for precise gene insertions or corrections.', category: 'Cellular Pathways' },
        { id: 'fc-3', front: 'What is "dead Cas9" (dCas9) and how is it utilized?', back: 'A mutated Cas9 with disabled cleavage domains. It binds targeted DNA without cutting, used to recruit activators, repressors, or deaminases.', category: 'Advanced Variants' },
      ],
      cheatSheet: [
        { key: 'Target Guide Length', value: '20 nucleotides' },
        { key: 'Standard PAM Sequence', value: '5\'-NGG-3\'' },
        { key: 'Cas9 Cut Location', value: '3-4 base pairs upstream of PAM' },
        { key: 'NHEJ Goal', value: 'Gene knockout via indel' },
        { key: 'HDR Goal', value: 'Gene knock-in via donor template' },
      ],
      generatedFromTopic: 'CRISPR-Cas9 & Gene Editing',
      createdAt: Date.now() - 3600000 * 5,
    },
    quiz: {
      id: 'quiz-crispr',
      title: 'CRISPR-Cas9 Mastery Assessment',
      topic: 'CRISPR-Cas9 & Gene Editing',
      difficulty: 'Intermediate',
      recommendedTimeMinutes: 5,
      questions: [
        {
          id: 'q1',
          type: 'mcq',
          question: 'What is the critical molecular requirement for Cas9 to bind and initiate cleavage at a targeted DNA locus?',
          options: [
            'A poly-A tail on the target gene',
            'A 5\'-NGG-3\' Protospacer Adjacent Motif (PAM) directly adjacent to the target',
            'Presence of DNA polymerase III at the replication fork',
            'Histone acetylation marks across chromatin',
          ],
          correctAnswer: 'A 5\'-NGG-3\' Protospacer Adjacent Motif (PAM) directly adjacent to the target',
          explanation: 'Cas9 strictly interrogates DNA for the PAM sequence (typically 5\'-NGG-3\' for Streptococcus pyogenes) before melting the double helix to check sgRNA base pairing.',
          conceptTested: 'PAM Recognition',
        },
        {
          id: 'q2',
          type: 'mcq',
          question: 'If a researcher wants to completely disrupt ("knock out") a metabolic enzyme gene in mammalian cells, which cellular repair pathway are they primarily relying upon after Cas9 cleavage?',
          options: [
            'Homology-Directed Repair (HDR) with single-stranded oligos',
            'Mismatch Repair (MMR) during G1 phase',
            'Non-Homologous End Joining (NHEJ) introducing frameshift indels',
            'Nucleotide Excision Repair (NER) removing thymine dimers',
          ],
          correctAnswer: 'Non-Homologous End Joining (NHEJ) introducing frameshift indels',
          explanation: 'NHEJ ligates broken DNA ends without a template and frequently makes insertion/deletion (indel) mistakes. This alters the reading frame and introduces premature stop codons, knocking out the gene.',
          conceptTested: 'Repair Mechanisms',
        },
        {
          id: 'q3',
          type: 'true_false',
          options: ['True', 'False'],
          question: 'True or False: Cas9 endonuclease directly carries out homologous recombination to paste the new gene sequence into the chromosome.',
          correctAnswer: 'False',
          explanation: 'False. Cas9 acts exclusively as a sequence-specific endonuclease to introduce a double-strand break. The actual recombination and DNA synthesis are performed by endogenous cellular repair enzymes through HDR.',
          conceptTested: 'Role of Cas9 vs Cellular Machinery',
        },
      ],
      createdAt: Date.now() - 3600000 * 5,
    },
  },
];

export function loadSavedTopics(): SavedStudyTopic[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(STARTER_TOPICS));
      return STARTER_TOPICS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return STARTER_TOPICS;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load saved topics from localStorage:', err);
    return STARTER_TOPICS;
  }
}

export function saveTopic(topic: SavedStudyTopic): void {
  try {
    const current = loadSavedTopics();
    const index = current.findIndex((t) => t.id === topic.id || t.topic.toLowerCase() === topic.topic.toLowerCase());
    if (index >= 0) {
      current[index] = { ...current[index], ...topic, updatedAt: Date.now() };
    } else {
      current.unshift({ ...topic, updatedAt: Date.now() });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save topic to localStorage:', err);
  }
}

export function deleteTopic(topicId: string): SavedStudyTopic[] {
  try {
    const current = loadSavedTopics().filter((t) => t.id !== topicId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return current;
  } catch (err) {
    console.error('Failed to delete topic:', err);
    return [];
  }
}
