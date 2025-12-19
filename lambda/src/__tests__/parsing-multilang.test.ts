/**
 * Multi-Language Parsing Test
 * Tests parsing functions against test sentences from all supported languages
 */

import { parseTaskFromUserRequest, parseQueryFromUserRequest, parseDeletionCondition } from '../utils/parsing';
import { cleanTaskName } from '../utils/alexa';
import type { Locale } from '../utils/parsing';

// Test sentences organized by language and intent type
const testSentences = {
  'en-US': {
    add: [
      'add buy milk',
      'add pick up dry cleaning',
      'create a task to call Sarah',
      'add pay rent next Tuesday',
      'add pick up dry cleaning tomorrow',
      'create a task to send the invoice at 4 pm',
      'add finish presentation to my work list',
      'add urgent task submit tax forms today',
      'add high priority work task finish report tomorrow at 3 pm',
    ],
    update: [
      'update finire rapporto',
      'update the task: mark clean the kitchen as done',
      'set email bank to done',
      'update finire rapporto priorità alta',
    ],
    delete: [
      'delete finire rapporto',
      'delete all completed tasks',
      'delete all work tasks',
      'delete tasks due today',
    ],
    query: [
      'what do I have for today',
      'what are my tasks for tomorrow',
      'show me high priority tasks',
      'what do I have for work',
      'show me tasks due today',
    ],
  },
  'it-IT': {
    add: [
      'aggiungi comprare il latte',
      'aggiungi ritirare la pulizia a secco',
      'crea un\'attività chiamare Sarah',
      'aggiungi pagare l\'affitto martedì prossimo',
      'aggiungi ritirare la pulizia a secco domani',
      'aggiungi finire presentazione alla mia lista lavoro',
      'aggiungi attività urgente inviare moduli fiscali oggi',
      'aggiungi attività lavoro alta priorità finire rapporto domani alle 15',
    ],
    update: [
      'aggiorna finire rapporto',
      'segna finire rapporto come fatto',
      'aggiorna chiamare Sarah a in corso',
      'aggiorna finire rapporto priorità alta',
      'aggiorna finire rapporto a domani',
    ],
    delete: [
      'elimina finire rapporto',
      'elimina tutte le attività completate',
      'elimina tutte le attività in corso',
      'elimina tutte le attività di lavoro',
      'elimina attività scadute',
    ],
    query: [
      'cosa ho per oggi',
      'quali sono le mie attività per domani',
      'mostrami attività alta priorità',
      'cosa ho di lavoro',
      'mostrami attività scadute',
    ],
  },
  'fr-FR': {
    add: [
      'ajouter acheter du lait',
      'ajouter récupérer le pressing',
      'créer une tâche appeler Sarah',
      'ajouter payer le loyer mardi prochain',
      'ajouter récupérer le pressing demain',
      'ajouter terminer présentation à ma liste travail',
      'ajouter tâche urgente soumettre formulaires fiscaux aujourd\'hui',
      'ajouter tâche travail haute priorité terminer rapport demain à 15 heures',
    ],
    update: [
      'mettre à jour terminer rapport',
      'marquer terminer rapport comme terminé',
      'mettre à jour appeler Sarah à en cours',
      'mettre à jour terminer rapport priorité haute',
      'mettre à jour terminer rapport à demain',
    ],
    delete: [
      'supprimer terminer rapport',
      'supprimer toutes les tâches terminées',
      'supprimer toutes les tâches en cours',
      'supprimer toutes les tâches de travail',
      'supprimer tâches en retard',
    ],
    query: [
      'qu\'est-ce que j\'ai pour aujourd\'hui',
      'quelles sont mes tâches pour demain',
      'montre-moi tâches haute priorité',
      'qu\'est-ce que j\'ai pour travail',
      'montre-moi tâches en retard',
    ],
  },
  'es-ES': {
    add: [
      'agregar comprar leche',
      'agregar recoger la tintorería',
      'crear una tarea llamar a Sarah',
      'agregar pagar alquiler el próximo martes',
      'agregar recoger la tintorería mañana',
      'agregar terminar presentación a mi lista trabajo',
      'agregar tarea urgente enviar formularios fiscales hoy',
      'agregar tarea trabajo alta prioridad terminar informe mañana a las 3 pm',
    ],
    update: [
      'actualizar terminar informe',
      'marcar terminar informe como hecho',
      'actualizar llamar a Sarah a en progreso',
      'actualizar terminar informe prioridad alta',
      'actualizar terminar informe a mañana',
    ],
    delete: [
      'eliminar terminar informe',
      'eliminar todas las tareas completadas',
      'eliminar todas las tareas en progreso',
      'eliminar todas las tareas de trabajo',
      'eliminar tareas vencidas',
    ],
    query: [
      'qué tengo para hoy',
      'cuáles son mis tareas para mañana',
      'muéstrame tareas alta prioridad',
      'qué tengo para trabajo',
      'muéstrame tareas vencidas',
    ],
  },
  'es-MX': {
    add: [
      'agregar comprar leche',
      'agregar recoger la tintorería',
      'crear una tarea llamar a Sarah',
      'agregar pagar alquiler el próximo martes',
      'agregar recoger la tintorería mañana',
      'agregar terminar presentación a mi lista trabajo',
      'agregar tarea urgente enviar formularios fiscales hoy',
      'agregar tarea trabajo alta prioridad terminar informe mañana a las 3 pm',
    ],
    update: [
      'actualizar terminar informe',
      'marcar terminar informe como hecho',
      'actualizar llamar a Sarah a en progreso',
      'actualizar terminar informe prioridad alta',
      'actualizar terminar informe a mañana',
    ],
    delete: [
      'eliminar terminar informe',
      'eliminar todas las tareas completadas',
      'eliminar todas las tareas en progreso',
      'eliminar todas las tareas de trabajo',
      'eliminar tareas vencidas',
    ],
    query: [
      'qué tengo para hoy',
      'cuáles son mis tareas para mañana',
      'muéstrame tareas alta prioridad',
      'qué tengo para trabajo',
      'muéstrame tareas vencidas',
    ],
  },
};

describe('Multi-Language Parsing Tests', () => {
  const locales: Locale[] = ['en-US', 'it-IT', 'fr-FR', 'es-ES', 'es-MX'];

  locales.forEach((locale) => {
    describe(`${locale} - Add Task Parsing`, () => {
      testSentences[locale].add.forEach((sentence) => {
        it(`should parse: "${sentence}"`, () => {
          const result = parseTaskFromUserRequest(sentence, locale);
          
          expect(result).toBeDefined();
          expect(result.taskName).toBeTruthy();
          expect(result.parsedName).toBeTruthy();
          expect(result.status).toMatch(/^(TO DO|DONE)$/);
          expect(result.category).toMatch(/^(PERSONAL|WORK)$/);
          expect(result.priority).toMatch(/^(LOW|NORMAL|HIGH)$/);
          
          // Check that parsed name is cleaned (no command words)
          expect(result.parsedName).not.toMatch(/^(add|create|aggiungi|crea|ajouter|agregar|crear)\s+/i);
        });
      });
    });

    describe(`${locale} - Update Task Parsing`, () => {
      testSentences[locale].update.forEach((sentence) => {
        it(`should clean: "${sentence}"`, () => {
          const cleaned = cleanTaskName(sentence, locale);
          
          expect(cleaned).toBeDefined();
          expect(typeof cleaned).toBe('string');
          // Should remove command prefixes
          expect(cleaned).not.toMatch(/^(update|aggiorna|mettre à jour|actualizar|segna|marquer|marcar)\s+/i);
        });
      });
    });

    describe(`${locale} - Delete Task Parsing`, () => {
      testSentences[locale].delete.forEach((sentence) => {
        it(`should parse deletion: "${sentence}"`, () => {
          const result = parseDeletionCondition(sentence, locale);
          
          expect(result).toBeDefined();
          expect(result.type).toMatch(/^(all|status|time|category|name)$/);
          
          if (result.type === 'status') {
            expect(result.status).toMatch(/^(TO DO|DONE)$/);
          }
          if (result.type === 'category') {
            expect(result.category).toMatch(/^(PERSONAL|WORK)$/);
          }
        });
      });
    });

    describe(`${locale} - Query Task Parsing`, () => {
      testSentences[locale].query.forEach((sentence) => {
        it(`should parse query: "${sentence}"`, () => {
          const result = parseQueryFromUserRequest(sentence, locale);
          
          expect(result).toBeDefined();
          expect(result.type).toMatch(/^(time|status|category|priority|keyword|combination)$/);
          expect(result.filters).toBeDefined();
          expect(typeof result.filters).toBe('object');
        });
      });
    });
  });

  // Test specific keyword extraction
  describe('Status Extraction', () => {
    it('should extract DONE status in all languages', () => {
      const tests = [
        { text: 'mark as done', locale: 'en-US' as Locale },
        { text: 'segna come fatto', locale: 'it-IT' as Locale },
        { text: 'marquer comme terminé', locale: 'fr-FR' as Locale },
        { text: 'marcar como hecho', locale: 'es-ES' as Locale },
      ];

      tests.forEach(({ text, locale }) => {
        const result = parseTaskFromUserRequest(text, locale);
        expect(result.status).toBe('DONE');
      });
    });

  });

  describe('Category Extraction', () => {
    it('should extract WORK category in all languages', () => {
      const tests = [
        { text: 'work task finish report', locale: 'en-US' as Locale },
        { text: 'attività lavoro finire rapporto', locale: 'it-IT' as Locale },
        { text: 'tâche travail terminer rapport', locale: 'fr-FR' as Locale },
        { text: 'tarea trabajo terminar informe', locale: 'es-ES' as Locale },
      ];

      tests.forEach(({ text, locale }) => {
        const result = parseTaskFromUserRequest(text, locale);
        expect(result.category).toBe('WORK');
      });
    });
  });

  describe('Priority Extraction', () => {
    it('should extract HIGH priority in all languages', () => {
      const tests = [
        { text: 'high priority task', locale: 'en-US' as Locale },
        { text: 'alta priorità attività', locale: 'it-IT' as Locale },
        { text: 'haute priorité tâche', locale: 'fr-FR' as Locale },
        { text: 'alta prioridad tarea', locale: 'es-ES' as Locale },
      ];

      tests.forEach(({ text, locale }) => {
        const result = parseTaskFromUserRequest(text, locale);
        expect(result.priority).toBe('HIGH');
      });
    });
  });
});





