
export interface Parada {
  cod: string;
  inicio: string;
  termino: string;
  total_min: number;
  equipamento: string;
}

export interface RegistroProducao {
  data_registro: string;
  linha_producao: string;
  turno: string; // Novo campo
  produto_volume: string;
  lote: string;
  paradas: Parada[];
  observacoes: string;
}

export enum ProcessStatus {
  IDLE = 'Aguardando captura...',
  CAPTURING = 'Capturando foto...',
  PROCESSING = 'Extraindo dados com IA...',
  SAVING = 'Salvando no banco de dados...',
  SUCCESS = 'Registro salvo com sucesso!',
  ERROR = 'Erro no processamento.'
}
