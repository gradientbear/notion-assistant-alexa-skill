/**
 * Normalize priority values from various languages to standard values
 */
export function normalizePriority(priority: string): 'LOW' | 'NORMAL' | 'HIGH' {
  if (!priority) return 'NORMAL';
  
  const lower = priority.toLowerCase();
  
  // Italian keywords
  if (lower === 'alta' || lower === 'high' || lower === 'urgente' || lower === 'importante') {
    return 'HIGH';
  }
  if (lower === 'bassa' || lower === 'low') {
    return 'LOW';
  }
  if (lower === 'normale' || lower === 'normal' || lower === 'media' || lower === 'medium') {
    return 'NORMAL';
  }
  
  // French keywords
  if (lower === 'haute' || lower === 'urgent') {
    return 'HIGH';
  }
  if (lower === 'basse') {
    return 'LOW';
  }
  
  // Spanish keywords
  if (lower === 'urgente' || lower === 'importante') {
    return 'HIGH';
  }
  if (lower === 'baja') {
    return 'LOW';
  }
  
  // Fallback to uppercase
  const upper = priority.toUpperCase();
  if (upper === 'MEDIUM') return 'NORMAL';
  return upper as 'LOW' | 'NORMAL' | 'HIGH';
}

/**
 * Normalize status values from various languages to standard values
 */
export function normalizeStatus(status: string): 'TO DO' | 'DONE' {
  if (!status) return 'TO DO';
  
  const lower = status.toLowerCase();
  
  // Italian keywords
  if (
    lower.includes('fatto') ||
    lower.includes('completato') ||
    lower.includes('finito') ||
    lower.includes('terminato') ||
    lower.includes('chius') ||     // chiuso/chiusa/chiusi/chiuse
    lower.includes('conclus')      // concluso/conclusa/conclusi/concluse
  ) {
    return 'DONE';
  }
  if (lower.includes('da fare') || lower.includes('todo') || lower.includes('in sospeso')) {
    return 'TO DO';
  }
  
  // French keywords
  if (lower.includes('terminé') || lower.includes('complété') || lower.includes('fini')) {
    return 'DONE';
  }
  if (lower.includes('à faire') || lower.includes('en attente')) {
    return 'TO DO';
  }
  
  // Spanish keywords
  if (lower.includes('hecho') || lower.includes('completado') || lower.includes('terminado')) {
    return 'DONE';
  }
  if (lower.includes('por hacer') || lower.includes('pendiente')) {
    return 'TO DO';
  }
  
  // English keywords
  if (
    lower.includes('done') ||
    lower.includes('complete') ||
    lower.includes('finished') ||
    lower.includes('closed') ||
    lower.includes('finished tasks') ||
    lower.includes('completed tasks') ||
    lower.includes('done tasks') ||
    lower.includes('closed tasks')
  ) {
    return 'DONE';
  }
  if (
    lower.includes('to do') ||
    lower.includes('todo') ||
    lower.includes('pending') ||
    lower.includes('open') ||
    lower.includes('incomplete')
  ) {
    return 'TO DO';
  }
  
  // Fallback: uppercase normalization
  const normalized = status.toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'DONE' || normalized === 'COMPLETE' || normalized === 'COMPLETED') {
    return 'DONE';
  }
  return 'TO DO';
}

/**
 * Normalize category values from various languages to standard values
 */
export function normalizeCategory(category: string): 'PERSONAL' | 'WORK' {
  if (!category) return 'PERSONAL';
  
  const lower = category.toLowerCase();
  
  // English keywords
  if (lower === 'work' || lower === 'office' || lower === 'business') {
    return 'WORK';
  }
  if (lower === 'personal' || lower === 'home' || lower === 'private') {
    return 'PERSONAL';
  }
  
  // Italian keywords
  if (lower === 'lavoro' || lower === 'ufficio' || lower === 'business') {
    return 'WORK';
  }
  if (lower === 'personale' || lower === 'personali' || lower === 'casa' || lower === 'privato') {
    return 'PERSONAL';
  }
  
  // French keywords
  if (lower === 'travail' || lower === 'bureau' || lower === 'professionnel') {
    return 'WORK';
  }
  if (lower === 'personnel' || lower === 'maison' || lower === 'privé') {
    return 'PERSONAL';
  }
  
  // Spanish keywords
  if (lower === 'trabajo' || lower === 'oficina' || lower === 'negocio') {
    return 'WORK';
  }
  if (lower === 'personal' || lower === 'casa' || lower === 'privado') {
    return 'PERSONAL';
  }
  
  // Fallback to uppercase
  const upper = category.toUpperCase();
  return upper === 'WORK' ? 'WORK' : 'PERSONAL';
}

