import { HandlerInput } from 'ask-sdk-core';

export type Locale = 'en-US' | 'it-IT';

/**
 * Get locale from request envelope
 */
export function getLocale(handlerInput: HandlerInput): Locale {
  const locale = handlerInput.requestEnvelope.request.locale || 'en-US';
  // Normalize to supported locales
  if (locale.startsWith('it')) {
    return 'it-IT';
  }
  return 'en-US';
}

/**
 * Translation strings for all supported locales
 */
const translations: Record<Locale, Record<string, string>> = {
  'en-US': {
    // Launch & Welcome
    'welcome': 'Welcome to Voice Planner! I can help you manage your tasks. You can add tasks, list your tasks, mark them complete, update their status, or delete them. You can also check your connection status. What would you like to do?',
    'welcome_reprompt': 'What would you like to do?',
    'welcome_error': 'Welcome to Voice Planner! I encountered an issue connecting to your account. Please try again later.',
    'welcome_error_simple': 'Welcome to Voice Planner. Please try again later.',
    
    // Notion Connection
    'notion_required': 'To use Voice Planner, you need to connect your Notion account. Open the Alexa app, go to Skills, find Voice Planner, and click Link Account. Once connected, I can help you manage your tasks in Notion. Would you like help connecting your account?',
    'notion_required_reprompt': 'Would you like help connecting your account?',
    'notion_required_simple': 'Please connect your Notion account in the Alexa app.',
    'notion_required_add': 'To add tasks, you need to connect your Notion account. Open the Alexa app, go to Skills, find Voice Planner, and click Link Account. Once connected, you can add tasks to your Notion workspace.',
    'notion_required_update': 'To update tasks, you need to connect your Notion account. Open the Alexa app, go to Skills, find Voice Planner, and click Link Account. Once connected, you can update your tasks.',
    'notion_required_delete': 'To delete tasks, you need to connect your Notion account. Open the Alexa app, go to Skills, find Voice Planner, and click Link Account. Once connected, you can delete tasks from your Notion workspace.',
    'notion_required_query': 'To view your tasks, you need to connect your Notion account. Open the Alexa app, go to Skills, find Voice Planner, and click Link Account. Once connected, I can show you your tasks from Notion.',
    'notion_db_not_found': 'I couldn\'t find your Tasks database in Notion. Please make sure the database exists and is named exactly "Tasks". You can reconnect your Notion account in the app to set it up again.',
    'notion_db_not_found_simple': 'I couldn\'t find your Tasks database in Notion. Please make sure it exists and try again.',
    'link_account': 'Please link your Notion account in the Alexa app to continue.',
    
    // Add Task
    'add_task_prompt': 'What task would you like to add?',
    'add_task_reprompt': 'Tell me the task you want to add.',
    'task_added': 'Added: {taskName}',
    'task_added_high': 'Added high priority task: {taskName}',
    'task_added_low': 'Added low priority task: {taskName}',
    'task_added_due_today': ', due today',
    'task_added_due_tomorrow': ', due tomorrow',
    'task_added_due_date': ', due {date}',
    'task_added_due_time': ' at {time}',
    'task_added_work': ' (work)',
    'add_task_error': 'I encountered an error adding your task. Please try again.',
    
    // Update Task
    'update_task_prompt': 'What task would you like to update?',
    'update_task_reprompt': 'Tell me which task to update and what to change.',
    'task_not_found': 'I couldn\'t find "{taskName}" in your tasks. Please try saying the full task name.',
    'update_unsure': 'I found "{taskName}", but I\'m not sure what you\'d like to update. You can update the status, priority, or due date. For example, say "mark it as done" or "set priority to high".',
    'task_updated': 'Updated "{taskName}": {updates}.',
    'status_done': 'done',
    'status_in_progress': 'in progress',
    'status_to_do': 'to do',
    'priority_high': 'high',
    'priority_low': 'low',
    'priority_normal': 'normal',
    'due_date_to': 'due date to {date}',
    'due_date_to_time': 'due date to {date} at {time}',
    'status_to': 'status to {status}',
    'priority_to': 'priority to {priority}',
    'update_task_error': 'I encountered an error updating your task. Please try again.',
    
    // Delete Task
    'delete_task_prompt': 'What task would you like to delete?',
    'delete_task_reprompt': 'Tell me which task to delete.',
    'no_completed_tasks': 'You have no completed tasks to delete.',
    'deleted_all_completed': 'Deleted all completed tasks.',
    'task_deleted': 'Deleted: {taskName} from your list.',
    'delete_task_error': 'I encountered an error deleting your task. Please try again.',
    
    // Query Tasks
    'query_task_prompt': 'What tasks would you like to see? For example, say "tasks for today" or "high priority tasks".',
    'no_tasks_matching': 'You have no tasks matching that criteria.',
    'task_due': ', due {date}',
    'task_due_time': ', due {date} at {time}',
    'high_priority': ' (high priority)',
    'tasks_count': 'You have {count} tasks: {list}.',
    'tasks_count_many': 'You have {count} tasks. Here are the first 10: {list}.',
    'query_task_error': 'I encountered an error retrieving your tasks. Please try again.',
    
    // Help & Unhandled
    'help': 'I can help you manage your tasks in Notion. You can add tasks, query your tasks, update tasks, or delete them. For example, say "add finish the report tomorrow at 5pm" or "what are my tasks for today". What would you like to do?',
    'unhandled': 'I\'m not sure how to help with that. I can help you manage your tasks in Notion. You can add a task, query your tasks, update a task, delete a task, or say "help" to learn more. What would you like to do?',
    'goodbye': 'Goodbye!',
    
    // Errors
    'error_generic': 'I encountered an error processing your request. Please try again.',
    'error_license': 'Your license key is invalid. Please contact support.',
    'error_auth': 'Please link your account in the Alexa app to use this skill.',
    'error_unhandled_intent': 'I\'m not sure how to help with that. You can add tasks, list tasks, mark them complete, update them, or delete them. What would you like to do?',
    'error_default': 'Sorry, I encountered an error. Please try again later.',
    
    // Common
    'what_else': 'What else would you like to do?',
    'what_would_you_like': 'What would you like to do?',
  },
  'it-IT': {
    // Launch & Welcome
    'welcome': 'Benvenuto in Voice Planner! Posso aiutarti a gestire le tue attività. Puoi aggiungere attività, elencare le tue attività, segnarle come completate, aggiornare il loro stato o eliminarle. Puoi anche controllare lo stato della connessione. Cosa vorresti fare?',
    'welcome_reprompt': 'Cosa vorresti fare?',
    'welcome_error': 'Benvenuto in Voice Planner! Ho riscontrato un problema nella connessione al tuo account. Riprova più tardi.',
    'welcome_error_simple': 'Benvenuto in Voice Planner. Riprova più tardi.',
    
    // Notion Connection
    'notion_required': 'Per usare Voice Planner, devi collegare il tuo account Notion. Apri l\'app Alexa, vai a Skill, trova Voice Planner e clicca su Collega Account. Una volta collegato, posso aiutarti a gestire le tue attività in Notion. Vuoi aiuto per collegare il tuo account?',
    'notion_required_reprompt': 'Vuoi aiuto per collegare il tuo account?',
    'notion_required_simple': 'Per favore, collega il tuo account Notion nell\'app Alexa.',
    'notion_required_add': 'Per aggiungere attività, devi collegare il tuo account Notion. Apri l\'app Alexa, vai a Skill, trova Voice Planner e clicca su Collega Account. Una volta collegato, puoi aggiungere attività al tuo spazio di lavoro Notion.',
    'notion_required_update': 'Per aggiornare le attività, devi collegare il tuo account Notion. Apri l\'app Alexa, vai a Skill, trova Voice Planner e clicca su Collega Account. Una volta collegato, puoi aggiornare le tue attività.',
    'notion_required_delete': 'Per eliminare le attività, devi collegare il tuo account Notion. Apri l\'app Alexa, vai a Skill, trova Voice Planner e clicca su Collega Account. Una volta collegato, puoi eliminare le attività dal tuo spazio di lavoro Notion.',
    'notion_required_query': 'Per visualizzare le tue attività, devi collegare il tuo account Notion. Apri l\'app Alexa, vai a Skill, trova Voice Planner e clicca su Collega Account. Una volta collegato, posso mostrarti le tue attività da Notion.',
    'notion_db_not_found': 'Non sono riuscito a trovare il tuo database Attività in Notion. Assicurati che il database esista e si chiami esattamente "Tasks". Puoi riconnettere il tuo account Notion nell\'app per configurarlo di nuovo.',
    'notion_db_not_found_simple': 'Non sono riuscito a trovare il tuo database Attività in Notion. Assicurati che esista e riprova.',
    'link_account': 'Per favore, collega il tuo account Notion nell\'app Alexa per continuare.',
    
    // Add Task
    'add_task_prompt': 'Quale attività vorresti aggiungere?',
    'add_task_reprompt': 'Dimmi l\'attività che vuoi aggiungere.',
    'task_added': 'Aggiunta: {taskName}',
    'task_added_high': 'Aggiunta attività ad alta priorità: {taskName}',
    'task_added_low': 'Aggiunta attività a bassa priorità: {taskName}',
    'task_added_due_today': ', scadenza oggi',
    'task_added_due_tomorrow': ', scadenza domani',
    'task_added_due_date': ', scadenza {date}',
    'task_added_due_time': ' alle {time}',
    'task_added_work': ' (lavoro)',
    'add_task_error': 'Ho riscontrato un errore nell\'aggiunta della tua attività. Riprova.',
    
    // Update Task
    'update_task_prompt': 'Quale attività vorresti aggiornare?',
    'update_task_reprompt': 'Dimmi quale attività aggiornare e cosa cambiare.',
    'task_not_found': 'Non sono riuscito a trovare "{taskName}" nelle tue attività. Prova a dire il nome completo dell\'attività.',
    'update_unsure': 'Ho trovato "{taskName}", ma non sono sicuro di cosa vorresti aggiornare. Puoi aggiornare lo stato, la priorità o la data di scadenza. Ad esempio, dici "segnala come fatto" o "imposta priorità alta".',
    'task_updated': 'Aggiornata "{taskName}": {updates}.',
    'status_done': 'fatto',
    'status_in_progress': 'in corso',
    'status_to_do': 'da fare',
    'priority_high': 'alta',
    'priority_low': 'bassa',
    'priority_normal': 'normale',
    'due_date_to': 'data di scadenza a {date}',
    'due_date_to_time': 'data di scadenza a {date} alle {time}',
    'status_to': 'stato a {status}',
    'priority_to': 'priorità a {priority}',
    'update_task_error': 'Ho riscontrato un errore nell\'aggiornamento della tua attività. Riprova.',
    
    // Delete Task
    'delete_task_prompt': 'Quale attività vorresti eliminare?',
    'delete_task_reprompt': 'Dimmi quale attività eliminare.',
    'no_completed_tasks': 'Non hai attività completate da eliminare.',
    'deleted_all_completed': 'Eliminate tutte le attività completate.',
    'task_deleted': 'Eliminata: {taskName} dalla tua lista.',
    'delete_task_error': 'Ho riscontrato un errore nell\'eliminazione della tua attività. Riprova.',
    
    // Query Tasks
    'query_task_prompt': 'Quali attività vorresti vedere? Ad esempio, dici "attività per oggi" o "attività ad alta priorità".',
    'no_tasks_matching': 'Non hai attività che corrispondono a questi criteri.',
    'task_due': ', scadenza {date}',
    'task_due_time': ', scadenza {date} alle {time}',
    'high_priority': ' (alta priorità)',
    'tasks_count': 'Hai {count} attività: {list}.',
    'tasks_count_many': 'Hai {count} attività. Ecco le prime 10: {list}.',
    'query_task_error': 'Ho riscontrato un errore nel recupero delle tue attività. Riprova.',
    
    // Help & Unhandled
    'help': 'Posso aiutarti a gestire le tue attività in Notion. Puoi aggiungere attività, interrogare le tue attività, aggiornare le attività o eliminarle. Ad esempio, dici "aggiungi finisci il rapporto domani alle 17" o "quali sono le mie attività per oggi". Cosa vorresti fare?',
    'unhandled': 'Non sono sicuro di come aiutarti con questo. Posso aiutarti a gestire le tue attività in Notion. Puoi aggiungere un\'attività, interrogare le tue attività, aggiornare un\'attività, eliminare un\'attività o dire "aiuto" per saperne di più. Cosa vorresti fare?',
    'goodbye': 'Arrivederci!',
    
    // Errors
    'error_generic': 'Ho riscontrato un errore nell\'elaborazione della tua richiesta. Riprova.',
    'error_license': 'La tua chiave di licenza non è valida. Contatta il supporto.',
    'error_auth': 'Per favore, collega il tuo account nell\'app Alexa per usare questa skill.',
    'error_unhandled_intent': 'Non sono sicuro di come aiutarti con questo. Puoi aggiungere attività, elencare le attività, segnarle come completate, aggiornarle o eliminarle. Cosa vorresti fare?',
    'error_default': 'Scusa, ho riscontrato un errore. Riprova più tardi.',
    
    // Common
    'what_else': 'Cos\'altro vorresti fare?',
    'what_would_you_like': 'Cosa vorresti fare?',
  },
};

/**
 * Translate a key with optional parameters
 */
export function t(key: string, locale: Locale, params?: Record<string, string | number>): string {
  const translation = translations[locale]?.[key] || translations['en-US'][key] || key;
  
  if (!params) {
    return translation;
  }
  
  // Replace placeholders like {taskName}, {count}, etc.
  return translation.replace(/\{(\w+)\}/g, (match, paramKey) => {
    return params[paramKey]?.toString() || match;
  });
}

/**
 * Get translation for handler input
 */
export function getTranslation(handlerInput: HandlerInput, key: string, params?: Record<string, string | number>): string {
  const locale = getLocale(handlerInput);
  return t(key, locale, params);
}


