import { HandlerInput } from 'ask-sdk-core';

export type Locale = 'en-US' | 'it-IT' | 'fr-FR' | 'es-ES' | 'es-MX';

/**
 * Get locale from request envelope
 */
export function getLocale(handlerInput: HandlerInput): Locale {
  const locale = handlerInput.requestEnvelope.request.locale || 'en-US';
  // Normalize to supported locales
  if (locale.startsWith('it')) {
    return 'it-IT';
  }
  if (locale.startsWith('fr')) {
    return 'fr-FR';
  }
  if (locale.startsWith('es')) {
    // Spanish: es-ES (Spain) or es-MX (Mexico)
    return locale === 'es-MX' ? 'es-MX' : 'es-ES';
  }
  return 'en-US';
}

/**
 * Translation strings for all supported locales
 */
const translations: Record<Locale, Record<string, string>> = {
  'en-US': {
    // Launch & Welcome
    'welcome': 'Welcome to Voice Planner! I can help you manage your tasks. You can add tasks, list your tasks, mark them complete, update their status, or delete them. What would you like to do?',
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
    'for_today_or_tomorrow': 'For today or tomorrow?',
    'say_today_or_tomorrow': 'Say today or tomorrow.',
    
    // Update Task
    'update_task_prompt': 'What task would you like to update?',
    'update_task_reprompt': 'Tell me which task to update and what to change.',
    'task_not_found': 'I couldn\'t find "{taskName}" in your tasks. Please try saying the full task name.',
    'update_unsure': 'I found "{taskName}", but I\'m not sure what you\'d like to update. You can update the status, priority, or due date. For example, say "mark it as done" or "set priority to high".',
    'task_updated': 'Updated "{taskName}": {updates}.',
    'status_done': 'done',
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
    'no_to_do_tasks': 'You have no to do tasks to delete.',
    'no_work_tasks': 'You have no work tasks to delete.',
    'no_personal_tasks': 'You have no personal tasks to delete.',
    'no_tasks_found': 'You have no tasks to delete.',
    'no_tasks_matching_time': 'You have no tasks matching that time criteria.',
    'deleted_all_completed': 'Deleted all completed tasks.',
    'deleted_all_to_do': 'Deleted {count} to do task(s).',
    'deleted_all_tasks': 'Deleted all {count} task(s).',
    'deleted_all_work_tasks': 'Deleted {count} work task(s).',
    'deleted_all_personal_tasks': 'Deleted {count} personal task(s).',
    'deleted_tasks_by_time': 'Deleted {count} task(s) matching that time.',
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
    'welcome': 'Benvenuto in Voice Planner! Posso aiutarti a gestire le tue attività. Puoi aggiungere attività, elencare le tue attività, segnarle come completate, aggiornare il loro stato o eliminarle. Cosa vorresti fare?',
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
    'for_today_or_tomorrow': 'Per oggi o per domani?',
    'say_today_or_tomorrow': 'Di\' oggi o domani.',
    
    // Update Task
    'update_task_prompt': 'Quale attività vorresti aggiornare?',
    'update_task_reprompt': 'Dimmi quale attività aggiornare e cosa cambiare.',
    'task_not_found': 'Non sono riuscito a trovare "{taskName}" nelle tue attività. Prova a dire il nome completo dell\'attività.',
    'update_unsure': 'Ho trovato "{taskName}", ma non sono sicuro di cosa vorresti aggiornare. Puoi aggiornare lo stato, la priorità o la data di scadenza. Ad esempio, dici "segnala come fatto" o "imposta priorità alta".',
    'task_updated': 'Aggiornata "{taskName}": {updates}.',
    'status_done': 'fatto',
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
    'no_to_do_tasks': 'Non hai attività da fare da eliminare.',
    'no_work_tasks': 'Non hai attività di lavoro da eliminare.',
    'no_personal_tasks': 'Non hai attività personali da eliminare.',
    'no_tasks_found': 'Non hai attività da eliminare.',
    'no_tasks_matching_time': 'Non hai attività che corrispondono a questi criteri temporali.',
    'deleted_all_completed': 'Eliminate tutte le attività completate.',
    'deleted_all_to_do': 'Eliminate {count} attività da fare.',
    'deleted_all_tasks': 'Eliminate tutte le {count} attività.',
    'deleted_all_work_tasks': 'Eliminate {count} attività di lavoro.',
    'deleted_all_personal_tasks': 'Eliminate {count} attività personali.',
    'deleted_tasks_by_time': 'Eliminate {count} attività che corrispondono a quel tempo.',
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
  'fr-FR': {
    // Launch & Welcome
    'welcome': 'Bienvenue dans Voice Planner ! Je peux vous aider à gérer vos tâches. Vous pouvez ajouter des tâches, lister vos tâches, les marquer comme terminées, mettre à jour leur statut ou les supprimer. Vous pouvez également vérifier le statut de votre connexion. Que souhaitez-vous faire ?',
    'welcome_reprompt': 'Que souhaitez-vous faire ?',
    'welcome_error': 'Bienvenue dans Voice Planner ! J\'ai rencontré un problème de connexion à votre compte. Veuillez réessayer plus tard.',
    'welcome_error_simple': 'Bienvenue dans Voice Planner. Veuillez réessayer plus tard.',
    
    // Notion Connection
    'notion_required': 'Pour utiliser Voice Planner, vous devez connecter votre compte Notion. Ouvrez l\'application Alexa, allez dans Compétences, trouvez Voice Planner et cliquez sur Lier le compte. Une fois connecté, je peux vous aider à gérer vos tâches dans Notion. Souhaitez-vous de l\'aide pour connecter votre compte ?',
    'notion_required_reprompt': 'Souhaitez-vous de l\'aide pour connecter votre compte ?',
    'notion_required_simple': 'Veuillez connecter votre compte Notion dans l\'application Alexa.',
    'notion_required_add': 'Pour ajouter des tâches, vous devez connecter votre compte Notion. Ouvrez l\'application Alexa, allez dans Compétences, trouvez Voice Planner et cliquez sur Lier le compte. Une fois connecté, vous pouvez ajouter des tâches à votre espace de travail Notion.',
    'notion_required_update': 'Pour mettre à jour les tâches, vous devez connecter votre compte Notion. Ouvrez l\'application Alexa, allez dans Compétences, trouvez Voice Planner et cliquez sur Lier le compte. Une fois connecté, vous pouvez mettre à jour vos tâches.',
    'notion_required_delete': 'Pour supprimer des tâches, vous devez connecter votre compte Notion. Ouvrez l\'application Alexa, allez dans Compétences, trouvez Voice Planner et cliquez sur Lier le compte. Une fois connecté, vous pouvez supprimer des tâches de votre espace de travail Notion.',
    'notion_required_query': 'Pour voir vos tâches, vous devez connecter votre compte Notion. Ouvrez l\'application Alexa, allez dans Compétences, trouvez Voice Planner et cliquez sur Lier le compte. Une fois connecté, je peux vous montrer vos tâches depuis Notion.',
    'notion_db_not_found': 'Je n\'ai pas pu trouver votre base de données Tâches dans Notion. Veuillez vous assurer que la base de données existe et s\'appelle exactement "Tasks". Vous pouvez reconnecter votre compte Notion dans l\'application pour la configurer à nouveau.',
    'notion_db_not_found_simple': 'Je n\'ai pas pu trouver votre base de données Tâches dans Notion. Veuillez vous assurer qu\'elle existe et réessayez.',
    'link_account': 'Veuillez lier votre compte Notion dans l\'application Alexa pour continuer.',
    
    // Add Task
    'add_task_prompt': 'Quelle tâche souhaitez-vous ajouter ?',
    'add_task_reprompt': 'Dites-moi la tâche que vous voulez ajouter.',
    'task_added': 'Ajoutée : {taskName}',
    'task_added_high': 'Tâche haute priorité ajoutée : {taskName}',
    'task_added_low': 'Tâche basse priorité ajoutée : {taskName}',
    'task_added_due_today': ', due aujourd\'hui',
    'task_added_due_tomorrow': ', due demain',
    'task_added_due_date': ', due {date}',
    'task_added_due_time': ' à {time}',
    'task_added_work': ' (travail)',
    'add_task_error': 'J\'ai rencontré une erreur lors de l\'ajout de votre tâche. Veuillez réessayer.',
    'for_today_or_tomorrow': 'Pour aujourd\'hui ou pour demain ?',
    'say_today_or_tomorrow': 'Dites aujourd\'hui ou demain.',
    
    // Update Task
    'update_task_prompt': 'Quelle tâche souhaitez-vous mettre à jour ?',
    'update_task_reprompt': 'Dites-moi quelle tâche mettre à jour et quoi changer.',
    'task_not_found': 'Je n\'ai pas pu trouver "{taskName}" dans vos tâches. Veuillez essayer de dire le nom complet de la tâche.',
    'update_unsure': 'J\'ai trouvé "{taskName}", mais je ne suis pas sûr de ce que vous souhaitez mettre à jour. Vous pouvez mettre à jour le statut, la priorité ou la date d\'échéance. Par exemple, dites "marquer comme terminé" ou "définir la priorité à élevée".',
    'task_updated': 'Mise à jour "{taskName}" : {updates}.',
    'status_done': 'terminé',
    'status_to_do': 'à faire',
    'priority_high': 'élevée',
    'priority_low': 'basse',
    'priority_normal': 'normale',
    'due_date_to': 'date d\'échéance au {date}',
    'due_date_to_time': 'date d\'échéance au {date} à {time}',
    'status_to': 'statut à {status}',
    'priority_to': 'priorité à {priority}',
    'update_task_error': 'J\'ai rencontré une erreur lors de la mise à jour de votre tâche. Veuillez réessayer.',
    
    // Delete Task
    'delete_task_prompt': 'Quelle tâche souhaitez-vous supprimer ?',
    'delete_task_reprompt': 'Dites-moi quelle tâche supprimer.',
    'no_completed_tasks': 'Vous n\'avez pas de tâches terminées à supprimer.',
    'no_to_do_tasks': 'Vous n\'avez pas de tâches à faire à supprimer.',
    'no_work_tasks': 'Vous n\'avez pas de tâches de travail à supprimer.',
    'no_personal_tasks': 'Vous n\'avez pas de tâches personnelles à supprimer.',
    'no_tasks_found': 'Vous n\'avez pas de tâches à supprimer.',
    'no_tasks_matching_time': 'Vous n\'avez pas de tâches correspondant à ces critères temporels.',
    'deleted_all_completed': 'Toutes les tâches terminées ont été supprimées.',
    'deleted_all_to_do': '{count} tâche(s) à faire supprimée(s).',
    'deleted_all_tasks': 'Toutes les {count} tâche(s) supprimée(s).',
    'deleted_all_work_tasks': '{count} tâche(s) de travail supprimée(s).',
    'deleted_all_personal_tasks': '{count} tâche(s) personnelle(s) supprimée(s).',
    'deleted_tasks_by_time': '{count} tâche(s) correspondant à ce temps supprimée(s).',
    'task_deleted': 'Supprimée : {taskName} de votre liste.',
    'delete_task_error': 'J\'ai rencontré une erreur lors de la suppression de votre tâche. Veuillez réessayer.',
    
    // Query Tasks
    'query_task_prompt': 'Quelles tâches souhaitez-vous voir ? Par exemple, dites "tâches pour aujourd\'hui" ou "tâches haute priorité".',
    'no_tasks_matching': 'Vous n\'avez pas de tâches correspondant à ces critères.',
    'task_due': ', due {date}',
    'task_due_time': ', due {date} à {time}',
    'high_priority': ' (haute priorité)',
    'tasks_count': 'Vous avez {count} tâche(s) : {list}.',
    'tasks_count_many': 'Vous avez {count} tâche(s). Voici les 10 premières : {list}.',
    'query_task_error': 'J\'ai rencontré une erreur lors de la récupération de vos tâches. Veuillez réessayer.',
    
    // Help & Unhandled
    'help': 'Je peux vous aider à gérer vos tâches dans Notion. Vous pouvez ajouter des tâches, interroger vos tâches, mettre à jour les tâches ou les supprimer. Par exemple, dites "ajouter terminer le rapport demain à 17 heures" ou "quelles sont mes tâches pour aujourd\'hui". Que souhaitez-vous faire ?',
    'unhandled': 'Je ne suis pas sûr de comment aider avec cela. Je peux vous aider à gérer vos tâches dans Notion. Vous pouvez ajouter une tâche, interroger vos tâches, mettre à jour une tâche, supprimer une tâche ou dire "aide" pour en savoir plus. Que souhaitez-vous faire ?',
    'goodbye': 'Au revoir !',
    
    // Errors
    'error_generic': 'J\'ai rencontré une erreur lors du traitement de votre demande. Veuillez réessayer.',
    'error_license': 'Votre clé de licence n\'est pas valide. Veuillez contacter le support.',
    'error_auth': 'Veuillez lier votre compte dans l\'application Alexa pour utiliser cette compétence.',
    'error_unhandled_intent': 'Je ne suis pas sûr de comment aider avec cela. Vous pouvez ajouter des tâches, lister des tâches, les marquer comme terminées, les mettre à jour ou les supprimer. Que souhaitez-vous faire ?',
    'error_default': 'Désolé, j\'ai rencontré une erreur. Veuillez réessayer plus tard.',
    
    // Common
    'what_else': 'Que souhaitez-vous faire d\'autre ?',
    'what_would_you_like': 'Que souhaitez-vous faire ?',
  },
  'es-ES': {
    // Launch & Welcome
    'welcome': '¡Bienvenido a Voice Planner! Puedo ayudarte a gestionar tus tareas. Puedes agregar tareas, listar tus tareas, marcarlas como completadas, actualizar su estado o eliminarlas. También puedes verificar el estado de tu conexión. ¿Qué te gustaría hacer?',
    'welcome_reprompt': '¿Qué te gustaría hacer?',
    'welcome_error': '¡Bienvenido a Voice Planner! He encontrado un problema al conectar con tu cuenta. Por favor, inténtalo de nuevo más tarde.',
    'welcome_error_simple': 'Bienvenido a Voice Planner. Por favor, inténtalo de nuevo más tarde.',
    
    // Notion Connection
    'notion_required': 'Para usar Voice Planner, necesitas conectar tu cuenta de Notion. Abre la aplicación Alexa, ve a Habilidades, encuentra Voice Planner y haz clic en Vincular cuenta. Una vez conectado, puedo ayudarte a gestionar tus tareas en Notion. ¿Te gustaría ayuda para conectar tu cuenta?',
    'notion_required_reprompt': '¿Te gustaría ayuda para conectar tu cuenta?',
    'notion_required_simple': 'Por favor, conecta tu cuenta de Notion en la aplicación Alexa.',
    'notion_required_add': 'Para agregar tareas, necesitas conectar tu cuenta de Notion. Abre la aplicación Alexa, ve a Habilidades, encuentra Voice Planner y haz clic en Vincular cuenta. Una vez conectado, puedes agregar tareas a tu espacio de trabajo de Notion.',
    'notion_required_update': 'Para actualizar tareas, necesitas conectar tu cuenta de Notion. Abre la aplicación Alexa, ve a Habilidades, encuentra Voice Planner y haz clic en Vincular cuenta. Una vez conectado, puedes actualizar tus tareas.',
    'notion_required_delete': 'Para eliminar tareas, necesitas conectar tu cuenta de Notion. Abre la aplicación Alexa, ve a Habilidades, encuentra Voice Planner y haz clic en Vincular cuenta. Una vez conectado, puedes eliminar tareas de tu espacio de trabajo de Notion.',
    'notion_required_query': 'Para ver tus tareas, necesitas conectar tu cuenta de Notion. Abre la aplicación Alexa, ve a Habilidades, encuentra Voice Planner y haz clic en Vincular cuenta. Una vez conectado, puedo mostrarte tus tareas desde Notion.',
    'notion_db_not_found': 'No pude encontrar tu base de datos de Tareas en Notion. Por favor, asegúrate de que la base de datos existe y se llama exactamente "Tasks". Puedes volver a conectar tu cuenta de Notion en la aplicación para configurarla de nuevo.',
    'notion_db_not_found_simple': 'No pude encontrar tu base de datos de Tareas en Notion. Por favor, asegúrate de que existe e inténtalo de nuevo.',
    'link_account': 'Por favor, vincula tu cuenta de Notion en la aplicación Alexa para continuar.',
    
    // Add Task
    'add_task_prompt': '¿Qué tarea te gustaría agregar?',
    'add_task_reprompt': 'Dime la tarea que quieres agregar.',
    'task_added': 'Agregada: {taskName}',
    'task_added_high': 'Tarea de alta prioridad agregada: {taskName}',
    'task_added_low': 'Tarea de baja prioridad agregada: {taskName}',
    'task_added_due_today': ', vence hoy',
    'task_added_due_tomorrow': ', vence mañana',
    'task_added_due_date': ', vence {date}',
    'task_added_due_time': ' a las {time}',
    'task_added_work': ' (trabajo)',
    'add_task_error': 'He encontrado un error al agregar tu tarea. Por favor, inténtalo de nuevo.',
    'for_today_or_tomorrow': '¿Para hoy o para mañana?',
    'say_today_or_tomorrow': 'Di hoy o mañana.',
    
    // Update Task
    'update_task_prompt': '¿Qué tarea te gustaría actualizar?',
    'update_task_reprompt': 'Dime qué tarea actualizar y qué cambiar.',
    'task_not_found': 'No pude encontrar "{taskName}" en tus tareas. Por favor, intenta decir el nombre completo de la tarea.',
    'update_unsure': 'Encontré "{taskName}", pero no estoy seguro de qué te gustaría actualizar. Puedes actualizar el estado, la prioridad o la fecha de vencimiento. Por ejemplo, di "marcar como hecho" o "establecer prioridad alta".',
    'task_updated': 'Actualizada "{taskName}": {updates}.',
    'status_done': 'hecho',
    'status_to_do': 'por hacer',
    'priority_high': 'alta',
    'priority_low': 'baja',
    'priority_normal': 'normal',
    'due_date_to': 'fecha de vencimiento al {date}',
    'due_date_to_time': 'fecha de vencimiento al {date} a las {time}',
    'status_to': 'estado a {status}',
    'priority_to': 'prioridad a {priority}',
    'update_task_error': 'He encontrado un error al actualizar tu tarea. Por favor, inténtalo de nuevo.',
    
    // Delete Task
    'delete_task_prompt': '¿Qué tarea te gustaría eliminar?',
    'delete_task_reprompt': 'Dime qué tarea eliminar.',
    'no_completed_tasks': 'No tienes tareas completadas para eliminar.',
    'no_to_do_tasks': 'No tienes tareas por hacer para eliminar.',
    'no_work_tasks': 'No tienes tareas de trabajo para eliminar.',
    'no_personal_tasks': 'No tienes tareas personales para eliminar.',
    'no_tasks_found': 'No tienes tareas para eliminar.',
    'no_tasks_matching_time': 'No tienes tareas que coincidan con esos criterios de tiempo.',
    'deleted_all_completed': 'Todas las tareas completadas han sido eliminadas.',
    'deleted_all_to_do': '{count} tarea(s) por hacer eliminada(s).',
    'deleted_all_tasks': 'Todas las {count} tarea(s) eliminada(s).',
    'deleted_all_work_tasks': '{count} tarea(s) de trabajo eliminada(s).',
    'deleted_all_personal_tasks': '{count} tarea(s) personal(es) eliminada(s).',
    'deleted_tasks_by_time': '{count} tarea(s) que coinciden con ese tiempo eliminada(s).',
    'task_deleted': 'Eliminada: {taskName} de tu lista.',
    'delete_task_error': 'He encontrado un error al eliminar tu tarea. Por favor, inténtalo de nuevo.',
    
    // Query Tasks
    'query_task_prompt': '¿Qué tareas te gustaría ver? Por ejemplo, di "tareas para hoy" o "tareas de alta prioridad".',
    'no_tasks_matching': 'No tienes tareas que coincidan con esos criterios.',
    'task_due': ', vence {date}',
    'task_due_time': ', vence {date} a las {time}',
    'high_priority': ' (alta prioridad)',
    'tasks_count': 'Tienes {count} tarea(s): {list}.',
    'tasks_count_many': 'Tienes {count} tarea(s). Aquí están las primeras 10: {list}.',
    'query_task_error': 'He encontrado un error al recuperar tus tareas. Por favor, inténtalo de nuevo.',
    
    // Help & Unhandled
    'help': 'Puedo ayudarte a gestionar tus tareas en Notion. Puedes agregar tareas, consultar tus tareas, actualizar tareas o eliminarlas. Por ejemplo, di "agregar terminar el informe mañana a las 5 pm" o "¿cuáles son mis tareas para hoy". ¿Qué te gustaría hacer?',
    'unhandled': 'No estoy seguro de cómo ayudar con eso. Puedo ayudarte a gestionar tus tareas en Notion. Puedes agregar una tarea, consultar tus tareas, actualizar una tarea, eliminar una tarea o decir "ayuda" para saber más. ¿Qué te gustaría hacer?',
    'goodbye': '¡Adiós!',
    
    // Errors
    'error_generic': 'He encontrado un error al procesar tu solicitud. Por favor, inténtalo de nuevo.',
    'error_license': 'Tu clave de licencia no es válida. Por favor, contacta con soporte.',
    'error_auth': 'Por favor, vincula tu cuenta en la aplicación Alexa para usar esta habilidad.',
    'error_unhandled_intent': 'No estoy seguro de cómo ayudar con eso. Puedes agregar tareas, listar tareas, marcarlas como completadas, actualizarlas o eliminarlas. ¿Qué te gustaría hacer?',
    'error_default': 'Lo siento, he encontrado un error. Por favor, inténtalo de nuevo más tarde.',
    
    // Common
    'what_else': '¿Qué más te gustaría hacer?',
    'what_would_you_like': '¿Qué te gustaría hacer?',
  },
  'es-MX': {
    // Launch & Welcome
    'welcome': '¡Bienvenido a Voice Planner! Puedo ayudarte a gestionar tus tareas. Puedes agregar tareas, listar tus tareas, marcarlas como completadas, actualizar su estado o eliminarlas. También puedes verificar el estado de tu conexión. ¿Qué te gustaría hacer?',
    'welcome_reprompt': '¿Qué te gustaría hacer?',
    'welcome_error': '¡Bienvenido a Voice Planner! He encontrado un problema al conectar con tu cuenta. Por favor, inténtalo de nuevo más tarde.',
    'welcome_error_simple': 'Bienvenido a Voice Planner. Por favor, inténtalo de nuevo más tarde.',
    
    // Notion Connection
    'notion_required': 'Para usar Voice Planner, necesitas conectar tu cuenta de Notion. Abre la aplicación Alexa, ve a Habilidades, encuentra Voice Planner y haz clic en Vincular cuenta. Una vez conectado, puedo ayudarte a gestionar tus tareas en Notion. ¿Te gustaría ayuda para conectar tu cuenta?',
    'notion_required_reprompt': '¿Te gustaría ayuda para conectar tu cuenta?',
    'notion_required_simple': 'Por favor, conecta tu cuenta de Notion en la aplicación Alexa.',
    'notion_required_add': 'Para agregar tareas, necesitas conectar tu cuenta de Notion. Abre la aplicación Alexa, ve a Habilidades, encuentra Voice Planner y haz clic en Vincular cuenta. Una vez conectado, puedes agregar tareas a tu espacio de trabajo de Notion.',
    'notion_required_update': 'Para actualizar tareas, necesitas conectar tu cuenta de Notion. Abre la aplicación Alexa, ve a Habilidades, encuentra Voice Planner y haz clic en Vincular cuenta. Una vez conectado, puedes actualizar tus tareas.',
    'notion_required_delete': 'Para eliminar tareas, necesitas conectar tu cuenta de Notion. Abre la aplicación Alexa, ve a Habilidades, encuentra Voice Planner y haz clic en Vincular cuenta. Una vez conectado, puedes eliminar tareas de tu espacio de trabajo de Notion.',
    'notion_required_query': 'Para ver tus tareas, necesitas conectar tu cuenta de Notion. Abre la aplicación Alexa, ve a Habilidades, encuentra Voice Planner y haz clic en Vincular cuenta. Una vez conectado, puedo mostrarte tus tareas desde Notion.',
    'notion_db_not_found': 'No pude encontrar tu base de datos de Tareas en Notion. Por favor, asegúrate de que la base de datos existe y se llama exactamente "Tasks". Puedes volver a conectar tu cuenta de Notion en la aplicación para configurarla de nuevo.',
    'notion_db_not_found_simple': 'No pude encontrar tu base de datos de Tareas en Notion. Por favor, asegúrate de que existe e inténtalo de nuevo.',
    'link_account': 'Por favor, vincula tu cuenta de Notion en la aplicación Alexa para continuar.',
    
    // Add Task
    'add_task_prompt': '¿Qué tarea te gustaría agregar?',
    'add_task_reprompt': 'Dime la tarea que quieres agregar.',
    'task_added': 'Agregada: {taskName}',
    'task_added_high': 'Tarea de alta prioridad agregada: {taskName}',
    'task_added_low': 'Tarea de baja prioridad agregada: {taskName}',
    'task_added_due_today': ', vence hoy',
    'task_added_due_tomorrow': ', vence mañana',
    'task_added_due_date': ', vence {date}',
    'task_added_due_time': ' a las {time}',
    'task_added_work': ' (trabajo)',
    'add_task_error': 'He encontrado un error al agregar tu tarea. Por favor, inténtalo de nuevo.',
    'for_today_or_tomorrow': '¿Para hoy o para mañana?',
    'say_today_or_tomorrow': 'Di hoy o mañana.',
    
    // Update Task
    'update_task_prompt': '¿Qué tarea te gustaría actualizar?',
    'update_task_reprompt': 'Dime qué tarea actualizar y qué cambiar.',
    'task_not_found': 'No pude encontrar "{taskName}" en tus tareas. Por favor, intenta decir el nombre completo de la tarea.',
    'update_unsure': 'Encontré "{taskName}", pero no estoy seguro de qué te gustaría actualizar. Puedes actualizar el estado, la prioridad o la fecha de vencimiento. Por ejemplo, di "marcar como hecho" o "establecer prioridad alta".',
    'task_updated': 'Actualizada "{taskName}": {updates}.',
    'status_done': 'hecho',
    'status_to_do': 'por hacer',
    'priority_high': 'alta',
    'priority_low': 'baja',
    'priority_normal': 'normal',
    'due_date_to': 'fecha de vencimiento al {date}',
    'due_date_to_time': 'fecha de vencimiento al {date} a las {time}',
    'status_to': 'estado a {status}',
    'priority_to': 'prioridad a {priority}',
    'update_task_error': 'He encontrado un error al actualizar tu tarea. Por favor, inténtalo de nuevo.',
    
    // Delete Task
    'delete_task_prompt': '¿Qué tarea te gustaría eliminar?',
    'delete_task_reprompt': 'Dime qué tarea eliminar.',
    'no_completed_tasks': 'No tienes tareas completadas para eliminar.',
    'no_to_do_tasks': 'No tienes tareas por hacer para eliminar.',
    'no_work_tasks': 'No tienes tareas de trabajo para eliminar.',
    'no_personal_tasks': 'No tienes tareas personales para eliminar.',
    'no_tasks_found': 'No tienes tareas para eliminar.',
    'no_tasks_matching_time': 'No tienes tareas que coincidan con esos criterios de tiempo.',
    'deleted_all_completed': 'Todas las tareas completadas han sido eliminadas.',
    'deleted_all_to_do': '{count} tarea(s) por hacer eliminada(s).',
    'deleted_all_tasks': 'Todas las {count} tarea(s) eliminada(s).',
    'deleted_all_work_tasks': '{count} tarea(s) de trabajo eliminada(s).',
    'deleted_all_personal_tasks': '{count} tarea(s) personal(es) eliminada(s).',
    'deleted_tasks_by_time': '{count} tarea(s) que coinciden con ese tiempo eliminada(s).',
    'task_deleted': 'Eliminada: {taskName} de tu lista.',
    'delete_task_error': 'He encontrado un error al eliminar tu tarea. Por favor, inténtalo de nuevo.',
    
    // Query Tasks
    'query_task_prompt': '¿Qué tareas te gustaría ver? Por ejemplo, di "tareas para hoy" o "tareas de alta prioridad".',
    'no_tasks_matching': 'No tienes tareas que coincidan con esos criterios.',
    'task_due': ', vence {date}',
    'task_due_time': ', vence {date} a las {time}',
    'high_priority': ' (alta prioridad)',
    'tasks_count': 'Tienes {count} tarea(s): {list}.',
    'tasks_count_many': 'Tienes {count} tarea(s). Aquí están las primeras 10: {list}.',
    'query_task_error': 'He encontrado un error al recuperar tus tareas. Por favor, inténtalo de nuevo.',
    
    // Help & Unhandled
    'help': 'Puedo ayudarte a gestionar tus tareas en Notion. Puedes agregar tareas, consultar tus tareas, actualizar tareas o eliminarlas. Por ejemplo, di "agregar terminar el informe mañana a las 5 pm" o "¿cuáles son mis tareas para hoy". ¿Qué te gustaría hacer?',
    'unhandled': 'No estoy seguro de cómo ayudar con eso. Puedo ayudarte a gestionar tus tareas en Notion. Puedes agregar una tarea, consultar tus tareas, actualizar una tarea, eliminar una tarea o decir "ayuda" para saber más. ¿Qué te gustaría hacer?',
    'goodbye': '¡Adiós!',
    
    // Errors
    'error_generic': 'He encontrado un error al procesar tu solicitud. Por favor, inténtalo de nuevo.',
    'error_license': 'Tu clave de licencia no es válida. Por favor, contacta con soporte.',
    'error_auth': 'Por favor, vincula tu cuenta en la aplicación Alexa para usar esta habilidad.',
    'error_unhandled_intent': 'No estoy seguro de cómo ayudar con eso. Puedes agregar tareas, listar tareas, marcarlas como completadas, actualizarlas o eliminarlas. ¿Qué te gustaría hacer?',
    'error_default': 'Lo siento, he encontrado un error. Por favor, inténtalo de nuevo más tarde.',
    
    // Common
    'what_else': '¿Qué más te gustaría hacer?',
    'what_would_you_like': '¿Qué te gustaría hacer?',
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


