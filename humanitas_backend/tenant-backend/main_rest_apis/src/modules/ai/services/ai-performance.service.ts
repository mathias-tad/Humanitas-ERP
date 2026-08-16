import { Injectable } from '@nestjs/common';

export interface ReviewSummary {
  originalText: string;
  summary: string;
  biasFlags: string[];
  suggestions: string[];
  overallSentiment: 'positive' | 'neutral' | 'negative';
}

export interface FlightRiskScore {
  employeeId: string;
  employeeName: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  signals: string[];
  recommendations: string[];
}

@Injectable()
export class AiPerformanceService {
  /**
   * Summarizes manager notes into a professional performance review paragraph.
   * Also scans for biased or subjective language and suggests improvements.
   */
  async summarizeReview(managerNotes: string): Promise<ReviewSummary> {
    // Bias detection patterns
    const biasPatterns = [
      { pattern: /\b(bossy|aggressive|abrasive)\b/gi, suggestion: 'Consider using "direct" or "assertive" instead.' },
      { pattern: /\b(too emotional|sensitive)\b/gi, suggestion: 'Focus on specific behaviours rather than emotional descriptors.' },
      { pattern: /\b(young|old|junior|senior) (for|to be)\b/gi, suggestion: 'Avoid age-related framing; focus on demonstrated competencies.' },
      { pattern: /\b(he|she) (always|never|usually)\b/gi, suggestion: 'Avoid absolute terms like always/never; use specific examples instead.' },
      { pattern: /\b(not a team player)\b/gi, suggestion: 'Describe specific collaboration incidents rather than general character assessments.' },
    ];

    const biasFlags: string[] = [];
    let processedText = managerNotes;

    for (const bp of biasPatterns) {
      if (bp.pattern.test(managerNotes)) {
        biasFlags.push(bp.suggestion);
      }
    }

    // Basic sentiment detection
    const positiveWords = ['excellent', 'outstanding', 'exceeded', 'exceptional', 'great', 'strong', 'impressive'];
    const negativeWords = ['poor', 'below', 'failed', 'missed', 'unsatisfactory', 'lacking', 'needs improvement'];

    const textLower = managerNotes.toLowerCase();
    const posCount = positiveWords.filter(w => textLower.includes(w)).length;
    const negCount = negativeWords.filter(w => textLower.includes(w)).length;

    const overallSentiment: 'positive' | 'neutral' | 'negative' =
      posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral';

    // Build a structured summary (in production, this would be LLM-generated)
    const summary = `Performance Summary: The employee demonstrated ${overallSentiment === 'positive' ? 'strong overall' : overallSentiment === 'negative' ? 'areas requiring improvement in' : 'satisfactory'} performance during the review period. ${biasFlags.length > 0 ? 'Note: Some language in the original notes may benefit from revision for objectivity.' : 'The review language is professional and objective.'} Key observations: ${managerNotes.substring(0, 200)}...`;

    return {
      originalText: managerNotes,
      summary,
      biasFlags,
      suggestions: biasFlags.length > 0
        ? ['Review flagged language for objectivity', 'Add specific measurable examples', 'Quantify achievements where possible']
        : ['Consider adding specific metrics to strengthen the review', 'Include examples of behaviours observed'],
      overallSentiment,
    };
  }
}
