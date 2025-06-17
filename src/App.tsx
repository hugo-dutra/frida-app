/* ---------- src/App.tsx ---------- */
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Typography,
  Select,
  MenuItem,
  TextField,
  Backdrop,
  CircularProgress,
  Popover,
  type SelectChangeEvent,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useState } from 'react';

// === Config ===
const ENDPOINT_FRIDA =
  'http://10.195.180.105:5678/webhook/frida-risk-question';
const ENDPOINT_CLARICE =
  'http://10.195.180.105:5678/webhook/clarice-corrige';

// === Eventos Estáticos (mock) ===
const STATIC_EVENTS = {
  complementaryInformationDto: {
    data: [
      'Estado Civil: SOLTEIRA',
      'Filhos: 4',
      'Filhos com o agressor: Sim',
      'Faixa etária Filhos: entre 3 a 16 anos',
      'Violência Física',
      'Violência Psicológica - Ameaça de morte',
      'Violência Psicológica - Outros tipos',
    ],
  },
  history: [
    {
      occurrenceDate: '',
      occurenceDescription: '',
    }
  ],
} as const;

// === Questões ===
const questions = [
  'A violência vem aumentando de gravidade e/ou de frequência no último mês?',
  'A senhora/você está grávida ou teve bebê nos últimos 18 meses?',
  'A senhora/você tem filhos(as) com o(a) agressor(a)? (Caso não tenham filhos em comum, o registro não se aplica)',
  'Em caso afirmativo, estão vivendo algum conflito com relação à guarda dos filhos, visitas ou pagamento de pensão pelo agressor?',
  'O(A) agressor(a) persegue a senhora/você, demonstra ciúme excessivo, tenta controlar sua vida e as coisas que você faz (onde você vai, com quem conversa, o tipo de roupa que usa etc.)?',
  'A senhora/você se separou recentemente do(a) agressor(a), tentou ou tem intenção de se separar? (Especifique: Separou / Tentou / Manifestou intenção)',
  'O(A) agressor(a) também é violento com outras pessoas (familiares, amigos, colegas etc.)? (Especificar: Crianças / Outros familiares / Outras pessoas)',
  'A senhora/você possui algum animal doméstico? (Caso não tenha animal doméstico, o registro não se aplica.)',
  'Em caso afirmativo, o(a) agressor(a) maltrata ou agride o animal?',
  'O(A) agressor(a) já a agrediu fisicamente outras vezes?',
  'Alguma vez o(a) agressor(a) tentou estrangular, sufocar ou afogar a senhora/você?',
  'O(A) agressor(a) já fez ameaças de morte ou tentou matar a senhora/você?',
  'O(A) agressor(a) já usou, ameaçou usar arma de fogo contra a senhora/você ou tem fácil acesso a uma? (Especifique: Usou / Ameaçou usar / Tem fácil acesso)',
  'O(A) agressor(a) já a ameaçou ou feriu com outro tipo de arma ou instrumento?',
  'A senhora/você necessitou de atendimento médico e/ou internação após alguma dessas agressões? (Especifique: Atendimento médico / Internação)',
  'O(A) agressor(a) é usuário de drogas e/ou bebidas alcoólicas?',
  'O(A) agressor(a) faz uso de medicação controlada para alguma doença mental/psiquiátrica?',
  'A senhora/você já teve ou tem medida protetiva de urgência? (Caso não tenha tido, o registro não se aplica.)',
  'O(A) agressor(a) já descumpriu medida protetiva de afastamento ou proibição de contato?',
  'O(A) agressor(a) já ameaçou ou tentou se matar alguma vez?',
  'O(A) agressor(a) já obrigou a senhora/você a ter relações sexuais contra a sua vontade?',
  'O(A) agressor(a) está com dificuldades financeiras, está desempregado ou tem dificuldade de se manter no emprego?',
] as const;

// === Tipagens auxiliares ===
type RespostaFlags = {
  sim: boolean;
  nao: boolean;
  naoSabe: boolean;
  naoSeAplica: boolean;
};
const labelKeyMap: Record<string, keyof RespostaFlags> = {
  SIM: 'sim',
  NÃO: 'nao',
  NS: 'naoSabe',
  NA: 'naoSeAplica',
};

// ================ Componente ================
export default function App() {
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [answerField, setAnswerField] = useState('');
  const [observacao, setObservacao] = useState('');
  const [outcome, setOutcome] = useState<keyof RespostaFlags | null>(null);
  const [lastRawJson, setLastRawJson] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentOccurrenceDescription, setCurrentOccurrenceDescription] = useState('');
  const [clariceSource, setClariceSource] = useState<'resposta' | 'ocorrencia' | null>(null);

  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number; source: 'resposta' | 'ocorrencia' | null }>({
    start: 0,
    end: 0,
    source: null,

  });

  // Pop-over Clarice
  const [clariceAnchor, setClariceAnchor] =
    useState<HTMLElement | null>(null);
  const [clariceBusy, setClariceBusy] = useState(false);

  /* ---------- Chamada IA FRIDA ---------- */
  const callApi = async () => {
    if (!selectedQuestion || !currentOccurrenceDescription.trim()) {
      alert('Preencha a descrição da ocorrência antes de enviar!');
      return;
    }

    setLoading(true);

    // Data atual no formato dd/MM/yyyy
    const today = new Date();
    const formattedDate = today.toLocaleDateString('pt-BR');

    const body = JSON.stringify({
      botId: '1',
      currentQuestion: selectedQuestion,
      events: {
        complementaryInformationDto: STATIC_EVENTS.complementaryInformationDto,
        history: [
          {
            occurrenceDate: formattedDate,
            occurenceDescription: currentOccurrenceDescription.trim(),
          },
        ],
      },
    });

    try {
      const res = await fetch(ENDPOINT_FRIDA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const json = await res.json();
      setLastRawJson(json);

      const ai = json.respostaDepoisDaAnaliseAI;
      const flags: RespostaFlags = {
        sim: ai.sim || false,
        nao: ai.nao || false,
        naoSabe: ai.naoSabe || false,
        naoSeAplica: ai.naoSeAplica || false,
      };

      setOutcome(
        (Object.keys(flags) as (keyof RespostaFlags)[]).find((k) => flags[k]) ?? null
      );

      const compInfo = (ai.complementaryInformation || [])
        .map((c: string) => `• ${c}`)
        .join('\n');
      setAnswerField(`${ai.trechoJustificativo}\n\n${compInfo}`);
      setObservacao(ai.observacaoComplementar || '');
    } catch (e) {
      console.error(e);
      setObservacao('Erro ao chamar API');
    } finally {
      setLoading(false);
    }
  };


  /* ---------- Chamada IA CLARICE ---------- */
  const handleClarice = async () => {
    const { start, end, source } = selectionRange;
    if (!source || start === end) {
      setClariceAnchor(null);
      return;
    }

    const text = source === 'resposta' ? answerField : currentOccurrenceDescription;
    const selectedText = text.slice(start, end);

    if (!selectedText.trim()) {
      setClariceAnchor(null);
      return;
    }

    setClariceBusy(true);
    try {
      const res = await fetch(ENDPOINT_CLARICE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText }),
      });
      const json = await res.json();
      if (json.output) {
        const newText = text.slice(0, start) + json.output + text.slice(end);
        if (source === 'resposta') {
          setAnswerField(newText);
        } else if (source === 'ocorrencia') {
          setCurrentOccurrenceDescription(newText);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClariceBusy(false);
      setClariceAnchor(null);
      setSelectionRange({ start: 0, end: 0, source: null });
    }
  };



  const handleTextFieldSelection = (e: React.SyntheticEvent, source: 'resposta' | 'ocorrencia') => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target || (typeof target.selectionStart !== 'number' || typeof target.selectionEnd !== 'number')) {
      setClariceAnchor(null);
      setSelectionRange({ start: 0, end: 0, source: null });
      return;
    }

    const start = target.selectionStart;
    const end = target.selectionEnd;

    if (start !== end) {
      setSelectionRange({ start, end, source });
      setClariceAnchor(target);
    } else {
      setSelectionRange({ start: 0, end: 0, source: null });
      setClariceAnchor(null);
    }
  };


  /* ---------- Seleção de texto  ---------- */
  const handleSelection = (
    e: React.SyntheticEvent<HTMLDivElement>,
    source: 'resposta' | 'ocorrencia'
  ) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length) {
      setClariceAnchor(e.currentTarget as HTMLElement);
      setClariceSource(source);
    } else {
      setClariceAnchor(null);
      setClariceSource(null);
    }
  };


  /* ---------- Diálogo detalhado ---------- */
  const getDialogContent = () => {
    if (!lastRawJson) return null;

    const { originalQuestion, originalEvents } = lastRawJson;
    const infoList = originalEvents?.complementaryInformationDto?.data || [];
    const historyList = originalEvents?.history || [];

    return (
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: '#202123', color: '#fff' }}>
          Pergunta: {originalQuestion}
        </DialogTitle>

        <DialogContent
          dividers
          sx={{ backgroundColor: '#121212', color: '#fff' }}
        >
          <Typography variant="h6" gutterBottom>
            Informações Complementares
          </Typography>
          <ul style={{ paddingLeft: '1.5rem' }}>
            {infoList.map((item: string, index: number) => (
              <li key={index}>{item}</li>
            ))}
          </ul>

          <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
            Histórico de Ocorrências
          </Typography>
          {historyList.map((entry: any, index: number) => (
            <Box
              key={index}
              sx={{
                mb: 2,
                p: 2,
                border: '1px solid #444',
                borderRadius: 2,
                backgroundColor: '#1e1e1e',
              }}
            >
              <Typography variant="subtitle2" sx={{ color: '#aaa' }}>
                {entry.occurrenceDate}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {entry.occurenceDescription}
              </Typography>
            </Box>
          ))}
        </DialogContent>

        <DialogActions sx={{ backgroundColor: '#202123' }}>
          <Button
            onClick={() => setDialogOpen(false)}
            color="primary"
            variant="contained"
          >
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  /* ---------- Handlers simples ---------- */
  const handleSelect = (e: SelectChangeEvent<string>) => {
    setSelectedQuestion(e.target.value as string);
    setAnswerField('');
    setOutcome(null);
  };
  const openWindowWithApiData = () => {
    if (lastRawJson) setDialogOpen(true);
  };

  const renderButton = (label: string) => {
    const key = labelKeyMap[label];
    const selected = outcome === key;

    const sxStyles = selected
      ? {
        fontWeight: 'bold',
        borderWidth: 2,
        borderColor: '#00e676',
        backgroundColor: '#00e676',
        boxShadow: '0 0 15px #00e676',
        color: '#000',
        transition: 'all 0.3s ease-in-out',
      }
      : {};

    return (
      <Button
        key={label}
        variant={selected ? 'contained' : 'outlined'}
        color="inherit"
        size="small"
        sx={sxStyles}
      >
        {label}
      </Button>
    );
  };

  /* --------------- JSX --------------- */
  return (
    <Box
      sx={{
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: 900,
        mx: 'auto',
      }}
    >
      <Select
        fullWidth
        displayEmpty
        value={selectedQuestion}
        onChange={handleSelect}
        renderValue={(v) => v || 'Selecione uma pergunta…'}
      >
        {questions.map((q) => (
          <MenuItem
            key={q}
            value={q}
            sx={{ whiteSpace: 'normal', lineHeight: 1.3 }}
          >
            {q}
          </MenuItem>
        ))}
      </Select>

      <TextField
        fullWidth
        multiline
        minRows={3}
        maxRows={6}
        label="Descrição da ocorrência (será enviada no histórico)"
        value={currentOccurrenceDescription}
        onChange={(e) => setCurrentOccurrenceDescription(e.target.value)}
        onMouseUp={(e) => handleTextFieldSelection(e, 'ocorrencia')}
        //onKeyUp={(e) => handleTextFieldSelection(e, 'ocorrencia')}
        placeholder="Descreva o ocorrido aqui..."
      />



      <Box sx={{ display: 'flex', gap: 2 }}>
        {['SIM', 'NÃO', 'NS', 'NA'].map(renderButton)}
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField
          fullWidth
          multiline
          minRows={6}
          maxRows={12}
          label="Resposta"
          value={answerField}
          onChange={(e) => setAnswerField(e.target.value)}
          onMouseUp={(e) => handleTextFieldSelection(e, 'resposta')}
          //onKeyUp={(e) => handleTextFieldSelection(e, 'resposta')}
          placeholder="Trecho justificativo + informações complementares"
        />


        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <IconButton
            color="primary"
            onClick={callApi}
            disabled={!selectedQuestion}
            sx={{ border: 1, borderColor: 'primary.main' }}
          >
            <PlayArrowIcon />
          </IconButton>
          <IconButton
            color="secondary"
            onClick={openWindowWithApiData}
            disabled={!lastRawJson}
            sx={{ border: 1, borderColor: 'primary.main' }}
          >
            <OpenInNewIcon />
          </IconButton>
        </Box>
      </Box>

      <TextField
        fullWidth
        multiline
        minRows={6}
        maxRows={12}
        label="Dados da API (observação complementar)"
        value={observacao}
        InputProps={{ readOnly: true }}
      />

      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        • Prova de conceito - Preenchimento do formulário Frida, com assistência
        de Inteligência Artificial •
      </Typography>

      {getDialogContent()}

      {/* Backdrop IA Frida */}
      <Backdrop
        sx={{
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          flexDirection: 'column',
        }}
        open={loading}
      >
        <CircularProgress color="inherit" />
        <Typography variant="subtitle1" sx={{ mt: 2 }}>
          Aguarde... IA processando análise dos dados sociais...
        </Typography>
      </Backdrop>

      {/* Pop-over Clarice */}
      <Popover
        open={Boolean(clariceAnchor)}
        anchorEl={clariceAnchor}
        onClose={() => setClariceAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, maxWidth: 220 }}>
          <Typography variant="body2" gutterBottom>
            Corrigir texto com a Clarice?
          </Typography>
          <Button
            variant="contained"
            size="small"
            fullWidth
            disabled={clariceBusy}
            onClick={handleClarice}
          >
            {clariceBusy ? (
              <CircularProgress size={16} sx={{ color: '#fff' }} />
            ) : (
              'Corrigir'
            )}
          </Button>
        </Box>
      </Popover>
    </Box>
  );
}




























