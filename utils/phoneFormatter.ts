/**
 * Formata telefone brasileiro para exibição visual
 * Extrai apenas o primeiro telefone se houver múltiplos
 * Formato de exibição: (DD) XXXXX-XXXX (sem +55)
 */
export const formatPhoneDisplay = (phone?: string | null): string => {
    if (!phone) return '-';

    let phoneStr = phone.toString().trim();
    let dddFromContext = '';

    // Primeiro, tenta extrair DDD se estiver separado (ex: "93 981046405")
    const dddPattern = /^(\d{2,3})\s+(\d{8,9})/;
    const dddMatch = phoneStr.match(dddPattern);
    if (dddMatch) {
        dddFromContext = dddMatch[1];
        phoneStr = dddMatch[2];
    } else {
        // Tenta extrair o primeiro telefone completo usando regex
        // Padrão: DD DDDDD-DDDD ou DD DDDD-DDDD
        const phonePattern = /(\d{2,3}[\s-]?\d{4,5}[\s-]?\d{4})/;
        const match = phoneStr.match(phonePattern);
        if (match) {
            phoneStr = match[1];
        } else {
            // Se não encontrou padrão, tenta separadores
            const separators = [' / ', '/', ' | ', '|', ';', ','];
            for (const sep of separators) {
                if (phoneStr.includes(sep)) {
                    const parts = phoneStr.split(sep).filter(p => p.trim().length > 0);
                    if (parts.length > 0) {
                        phoneStr = parts[0].trim();
                        break;
                    }
                }
            }
        }
    }

    const cleaned = phoneStr.replace(/\D/g, '');
    if (!cleaned) return '-';

    // Formata baseado no tamanho (SEM +55 na exibição)
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const part1 = cleaned.substring(4, 9);
        const part2 = cleaned.substring(9, 13);
        return `(${ddd}) ${part1}-${part2}`;
    }

    if (cleaned.length === 12 && cleaned.startsWith('55')) {
        const ddd = cleaned.substring(2, 4);
        const part1 = cleaned.substring(4, 8);
        const part2 = cleaned.substring(8, 12);
        return `(${ddd}) ${part1}-${part2}`;
    }

    if (cleaned.length === 11) {
        const ddd = cleaned.substring(0, 2);
        const part1 = cleaned.substring(2, 7);
        const part2 = cleaned.substring(7, 11);
        return `(${ddd}) ${part1}-${part2}`;
    }

    if (cleaned.length === 10) {
        const ddd = cleaned.substring(0, 2);
        const part1 = cleaned.substring(2, 6);
        const part2 = cleaned.substring(6, 10);
        return `(${ddd}) ${part1}-${part2}`;
    }

    // Se tem 9 dígitos e temos DDD do contexto
    if (cleaned.length === 9 && dddFromContext) {
        const part1 = cleaned.substring(0, 5);
        const part2 = cleaned.substring(5, 9);
        return `(${dddFromContext}) ${part1}-${part2}`;
    }

    // Se tem 8 dígitos e temos DDD do contexto
    if (cleaned.length === 8 && dddFromContext) {
        const part1 = cleaned.substring(0, 4);
        const part2 = cleaned.substring(4, 8);
        return `(${dddFromContext}) ${part1}-${part2}`;
    }

    return cleaned;
};
