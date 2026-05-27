package it.medico.diari;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.util.PDFTextStripper;

import javax.imageio.ImageIO;
import javax.swing.*;
import javax.swing.border.*;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.awt.datatransfer.*;
import java.awt.event.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.text.*;
import java.util.*;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Strumenti Diari Medici v2.0
 *
 *  Tab 1 — Ricerca full-text nei PDF dei diari
 *  Tab 2 — Estrazione parametri vitali da screenshot via OCR online (OCR.Space)
 *
 * Requisiti: Java 8+, PDFBox 1.8 sul classpath (o fat-JAR)
 * Non richiede installazione ne' diritti di amministratore.
 */
public class RicercaDiari extends JFrame {

    private static final long serialVersionUID = 2L;
    private static final String PREFS_FILE =
            System.getProperty("user.home") + File.separator + ".strumentidiari.properties";

    static final Color BLU   = new Color(0, 83, 156);
    static final Color VERDE = new Color(0, 120, 0);
    static final Color ROSSO = new Color(160, 0, 0);

    public RicercaDiari() {
        super("Strumenti Diari Medici  v2.0");
        try { UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName()); } catch (Exception ignored) {}

        JTabbedPane tabs = new JTabbedPane(JTabbedPane.TOP);
        tabs.setFont(new Font("SansSerif", Font.BOLD, 13));

        PannelloRicercaPDF pRicerca = new PannelloRicercaPDF(this);
        PannelloParametriVitali pOCR = new PannelloParametriVitali(this);

        tabs.addTab("  Ricerca PDF  ", null, pRicerca, "Cerca termini nei PDF dei diari");
        tabs.addTab("  Parametri Vitali (OCR)  ", null, pOCR, "Estrai parametri vitali da screenshot");

        setContentPane(tabs);
        setDefaultCloseOperation(EXIT_ON_CLOSE);
        addWindowListener(new WindowAdapter() {
            @Override public void windowClosing(WindowEvent e) {
                pRicerca.savePrefs(); pOCR.savePrefs();
            }
        });
        pRicerca.loadPrefs(); pOCR.loadPrefs();
        pack();
        setMinimumSize(new Dimension(900, 650));
        setLocationRelativeTo(null);
    }

    // =========================================================================
    // UTILITY STATICHE CONDIVISE
    // =========================================================================

    static JPanel titledPanel(String titolo) {
        JPanel p = new JPanel();
        p.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createTitledBorder(
                        BorderFactory.createLineBorder(new Color(180, 200, 230)),
                        " " + titolo + " ",
                        TitledBorder.LEFT, TitledBorder.TOP,
                        new Font("SansSerif", Font.BOLD, 12), BLU),
                new EmptyBorder(4, 6, 6, 6)));
        p.setAlignmentX(Component.LEFT_ALIGNMENT);
        p.setMaximumSize(new Dimension(Integer.MAX_VALUE, Integer.MAX_VALUE));
        return p;
    }

    static Component vspace(int h) { return Box.createRigidArea(new Dimension(0, h)); }

    static JLabel htmlLabel(String html, Color c, int small) {
        String size = (small <= 11) ? "-1" : "0";
        JLabel l = new JLabel("<html><font color='" + hex(c) + "' size='" + size + "'>" + html + "</font></html>");
        l.setAlignmentX(Component.LEFT_ALIGNMENT);
        return l;
    }

    static String hex(Color c) {
        return String.format("#%02x%02x%02x", c.getRed(), c.getGreen(), c.getBlue());
    }

    static String esc(String s) {
        if (s == null) return "";
        return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");
    }

    static GridBagConstraints gbc() {
        GridBagConstraints g = new GridBagConstraints();
        g.insets = new Insets(4,4,4,4);
        g.fill = GridBagConstraints.HORIZONTAL;
        return g;
    }

    // =========================================================================
    // MAIN
    // =========================================================================

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> new RicercaDiari().setVisible(true));
    }


    // #########################################################################
    // TAB 1 — RICERCA PDF
    // #########################################################################

    static class PannelloRicercaPDF extends JPanel {

        private final RicercaDiari frame;

        // GUI
        private final JTextField txtDiarMedici = new JTextField();
        private final JTextField txtDiarInf    = new JTextField();
        private final JTextField txtTermini    = new JTextField();
        private final JRadioButton rbAnd       = new JRadioButton("AND  (tutti i termini devono essere presenti nello stesso PDF)", true);
        private final JRadioButton rbOr        = new JRadioButton("OR   (basta che almeno un termine sia presente)");
        private final JTextField txtDataInizio = new JTextField("", 10);
        private final JTextField txtDataFine   = new JTextField("", 10);
        private final JRadioButton rbInizio    = new JRadioButton("Dall'inizio (prima pagina prima)", true);
        private final JRadioButton rbFine      = new JRadioButton("Dalla fine (ultima pagina prima)");
        private final JRadioButton rbUltime    = new JRadioButton("Solo le ultime  ");
        private final JSpinner spinPagine      = new JSpinner(new SpinnerNumberModel(2,1,999,1));
        private final JRadioButton rbStopPrimo = new JRadioButton("Fermarsi al primo PDF positivo per paziente", true);
        private final JRadioButton rbStopTutti = new JRadioButton("Analizzare TUTTI i PDF del paziente");
        private final JPanel pnlOrStopper      = new JPanel();
        private final JRadioButton rbOrQualsiasi = new JRadioButton("Fermarsi appena trovato uno qualsiasi dei termini OR", true);
        private final JRadioButton rbOrTutti   = new JRadioButton("Fermarsi solo dopo aver trovato TUTTI i termini OR");
        private final JButton btnCerca         = new JButton("  AVVIA RICERCA  ");
        private final JButton btnAnnulla       = new JButton("Annulla");
        private final JProgressBar progressBar = new JProgressBar(0, 100);
        private final JLabel lblStatus         = new JLabel("Pronto. Configura e avvia la ricerca.");
        private final JPanel pnlRisultati      = new JPanel();

        private SearchWorker currentWorker = null;

        PannelloRicercaPDF(RicercaDiari frame) {
            this.frame = frame;
            setLayout(new BorderLayout());
            JPanel main = new JPanel();
            main.setLayout(new BoxLayout(main, BoxLayout.Y_AXIS));
            main.setBorder(new EmptyBorder(10,12,10,12));

            main.add(buildPanelCartelle());
            main.add(vspace(8));
            main.add(buildPanelTermini());
            main.add(vspace(8));
            main.add(buildPanelDate());
            main.add(vspace(8));
            main.add(buildPanelLettura());
            main.add(vspace(8));
            main.add(buildPanelStopper());
            main.add(vspace(12));
            main.add(buildPanelSearch());
            main.add(vspace(10));
            main.add(buildPanelRisultati());

            JScrollPane sp = new JScrollPane(main);
            sp.getVerticalScrollBar().setUnitIncrement(16);
            sp.setBorder(null);
            add(sp, BorderLayout.CENTER);
        }

        // ---------- costruzione pannelli ----------

        private JPanel buildPanelCartelle() {
            JPanel p = titledPanel("1 - Cartelle dei Diari");
            p.setLayout(new GridBagLayout());
            GridBagConstraints g = gbc();
            g.gridy = 0; addFolderRow(p, g, "Diari Medici:", txtDiarMedici);
            g.gridy = 1; addFolderRow(p, g, "Diari Infermieristici:", txtDiarInf);
            g.gridy = 2; g.gridx = 0; g.gridwidth = 3;
            p.add(htmlLabel("* Almeno una cartella. Ogni paziente deve avere la sua sottocartella con i PDF.", Color.GRAY, 11), g);
            return p;
        }

        private void addFolderRow(JPanel p, GridBagConstraints g, String label, JTextField field) {
            g.gridx=0; g.gridwidth=1; g.weightx=0; g.fill=GridBagConstraints.NONE;
            p.add(new JLabel(label), g);
            g.gridx=1; g.weightx=1; g.fill=GridBagConstraints.HORIZONTAL;
            p.add(field, g);
            g.gridx=2; g.weightx=0; g.fill=GridBagConstraints.NONE;
            JButton btn = new JButton("Sfoglia...");
            btn.addActionListener(e -> {
                JFileChooser fc = new JFileChooser(field.getText().isEmpty()
                        ? System.getProperty("user.home") : field.getText());
                fc.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
                if (fc.showOpenDialog(frame) == JFileChooser.APPROVE_OPTION)
                    field.setText(fc.getSelectedFile().getAbsolutePath());
            });
            p.add(btn, g);
        }

        private JPanel buildPanelTermini() {
            JPanel p = titledPanel("2 - Termini di Ricerca");
            p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
            JPanel rigaT = new JPanel(new BorderLayout(6,0));
            rigaT.setOpaque(false);
            rigaT.add(new JLabel("Termini (separati da virgola):  "), BorderLayout.WEST);
            rigaT.add(txtTermini, BorderLayout.CENTER);
            p.add(rigaT);
            p.add(vspace(4));
            p.add(htmlLabel("Es: <b>febbre, ipotensione</b>  &mdash;  ignora maiuscole/minuscole", Color.DARK_GRAY, 11));
            p.add(vspace(6));
            ButtonGroup bg = new ButtonGroup(); bg.add(rbAnd); bg.add(rbOr);
            p.add(rbAnd); p.add(vspace(2)); p.add(rbOr);
            rbOr.addChangeListener(e -> aggiornaOrStopper());
            rbAnd.addChangeListener(e -> aggiornaOrStopper());
            return p;
        }

        private JPanel buildPanelDate() {
            JPanel p = titledPanel("3 - Intervallo Date (opzionale)");
            p.setLayout(new FlowLayout(FlowLayout.LEFT, 6, 4));
            p.add(new JLabel("Da:")); txtDataInizio.setToolTipText("gg/mm/aaaa"); p.add(txtDataInizio);
            p.add(new JLabel("   A:")); txtDataFine.setToolTipText("gg/mm/aaaa"); p.add(txtDataFine);
            p.add(htmlLabel("  Formato: <b>gg/mm/aaaa</b>  (vuoto = nessun filtro)", Color.DARK_GRAY, 11));
            return p;
        }

        private JPanel buildPanelLettura() {
            JPanel p = titledPanel("4 - Modalita' di Lettura dei PDF");
            ButtonGroup bg = new ButtonGroup(); bg.add(rbInizio); bg.add(rbFine); bg.add(rbUltime);
            rbUltime.addChangeListener(e -> spinPagine.setEnabled(rbUltime.isSelected()));
            spinPagine.setEnabled(false);
            ((JSpinner.DefaultEditor) spinPagine.getEditor()).getTextField().setColumns(3);
            p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
            p.add(rbInizio); p.add(rbFine);
            JPanel row = new JPanel(new FlowLayout(FlowLayout.LEFT,0,0)); row.setOpaque(false);
            row.add(rbUltime); row.add(spinPagine); row.add(new JLabel("  pagine del PDF"));
            p.add(row);
            return p;
        }

        private JPanel buildPanelStopper() {
            JPanel p = titledPanel("5 - Comportamento dopo il Primo Match");
            ButtonGroup bg = new ButtonGroup(); bg.add(rbStopPrimo); bg.add(rbStopTutti);
            p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
            p.add(rbStopPrimo); p.add(rbStopTutti);
            p.add(vspace(6));
            pnlOrStopper.setOpaque(false);
            pnlOrStopper.setLayout(new BoxLayout(pnlOrStopper, BoxLayout.Y_AXIS));
            pnlOrStopper.add(htmlLabel("<u>Solo per logica OR — quando considerare il paziente trovato:</u>", BLU, 11));
            ButtonGroup bgOr = new ButtonGroup(); bgOr.add(rbOrQualsiasi); bgOr.add(rbOrTutti);
            pnlOrStopper.add(rbOrQualsiasi); pnlOrStopper.add(rbOrTutti);
            pnlOrStopper.setVisible(false);
            p.add(pnlOrStopper);
            rbStopPrimo.addChangeListener(e -> aggiornaOrStopper());
            rbStopTutti.addChangeListener(e -> aggiornaOrStopper());
            return p;
        }

        private void aggiornaOrStopper() {
            pnlOrStopper.setVisible(rbOr.isSelected() && rbStopPrimo.isSelected());
            revalidate();
        }

        private JPanel buildPanelSearch() {
            JPanel p = new JPanel();
            p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
            progressBar.setStringPainted(true); progressBar.setString("");
            progressBar.setMaximumSize(new Dimension(Integer.MAX_VALUE, 22));
            progressBar.setAlignmentX(LEFT_ALIGNMENT);
            lblStatus.setAlignmentX(LEFT_ALIGNMENT);
            lblStatus.setFont(new Font("SansSerif", Font.PLAIN, 11));
            btnCerca.setFont(new Font("SansSerif", Font.BOLD, 14));
            btnCerca.setBackground(BLU); btnCerca.setForeground(Color.WHITE);
            btnCerca.setFocusPainted(false); btnCerca.setAlignmentX(LEFT_ALIGNMENT);
            btnCerca.addActionListener(e -> avviaRicerca());
            btnAnnulla.setEnabled(false); btnAnnulla.setAlignmentX(LEFT_ALIGNMENT);
            btnAnnulla.addActionListener(e -> { if (currentWorker!=null) currentWorker.cancel(true); btnAnnulla.setEnabled(false); });
            JPanel rigaBtn = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
            rigaBtn.setOpaque(false); rigaBtn.setAlignmentX(LEFT_ALIGNMENT);
            rigaBtn.add(btnCerca); rigaBtn.add(btnAnnulla);
            p.add(rigaBtn); p.add(vspace(6)); p.add(progressBar); p.add(vspace(3)); p.add(lblStatus);
            return p;
        }

        private JPanel buildPanelRisultati() {
            pnlRisultati.setLayout(new BoxLayout(pnlRisultati, BoxLayout.Y_AXIS));
            pnlRisultati.setBackground(Color.WHITE);
            JScrollPane sp = new JScrollPane(pnlRisultati);
            sp.setPreferredSize(new Dimension(760, 300));
            JPanel p = titledPanel("RISULTATI");
            p.setLayout(new BorderLayout());
            p.add(sp, BorderLayout.CENTER);
            return p;
        }

        // ---------- logica di ricerca ----------

        private void avviaRicerca() {
            String pathMed = txtDiarMedici.getText().trim();
            String pathInf = txtDiarInf.getText().trim();
            if (pathMed.isEmpty() && pathInf.isEmpty()) { err("Selezionare almeno una cartella."); return; }
            String rawT = txtTermini.getText().trim();
            if (rawT.isEmpty()) { err("Inserire almeno un termine."); return; }
            List<String> termini = parseTermini(rawT);
            if (termini.isEmpty()) { err("Nessun termine valido."); return; }

            Date dIn = null, dFin = null;
            try { if (!txtDataInizio.getText().trim().isEmpty()) dIn  = parseData(txtDataInizio.getText().trim()); }
            catch (ParseException ex) { err("Data inizio non valida (gg/mm/aaaa)."); return; }
            try { if (!txtDataFine.getText().trim().isEmpty())   dFin = parseData(txtDataFine.getText().trim()); }
            catch (ParseException ex) { err("Data fine non valida (gg/mm/aaaa)."); return; }
            if (dIn!=null && dFin!=null && dIn.after(dFin)) { err("La data inizio deve precedere la data fine."); return; }

            SearchConfig cfg = new SearchConfig();
            cfg.termini     = termini;
            cfg.logicaAnd   = rbAnd.isSelected();
            cfg.dataInizio  = dIn; cfg.dataFine = dFin;
            cfg.lettura     = rbInizio.isSelected() ? LetturaMode.INIZIO : rbFine.isSelected() ? LetturaMode.FINE : LetturaMode.ULTIME_N;
            cfg.nPagine     = (Integer) spinPagine.getValue();
            cfg.stopAlPrimo = rbStopPrimo.isSelected();
            cfg.orStopperTutti = rbOrTutti.isSelected();

            List<File> cartelle = new ArrayList<>();
            if (!pathMed.isEmpty() && new File(pathMed).isDirectory()) cartelle.add(new File(pathMed));
            if (!pathInf.isEmpty() && new File(pathInf).isDirectory()) cartelle.add(new File(pathInf));
            if (cartelle.isEmpty()) { err("Le cartelle selezionate non esistono."); return; }

            pnlRisultati.removeAll(); pnlRisultati.revalidate(); pnlRisultati.repaint();
            btnCerca.setEnabled(false); btnAnnulla.setEnabled(true);
            progressBar.setValue(0); progressBar.setString("Avvio...");
            savePrefs();

            currentWorker = new SearchWorker(cfg, cartelle);
            currentWorker.execute();
        }

        // ---------- SwingWorker ----------

        private class SearchWorker extends SwingWorker<List<PatientResult>, String> {
            final SearchConfig cfg; final List<File> cartelle;
            SearchWorker(SearchConfig c, List<File> cart) { cfg=c; cartelle=cart; }

            @Override
            protected List<PatientResult> doInBackground() {
                List<PatientResult> risultati = new ArrayList<>();
                List<File[]> gruppi = new ArrayList<>();
                for (File root : cartelle) {
                    File[] sub = root.listFiles(File::isDirectory);
                    if (sub != null) { Arrays.sort(sub, Comparator.comparing(File::getName)); gruppi.add(sub); }
                    else gruppi.add(new File[0]);
                }
                int tot = 0; for (File[] g : gruppi) tot += g.length;
                int elab = 0;
                for (int ci = 0; ci < cartelle.size(); ci++) {
                    if (isCancelled()) break;
                    File root = cartelle.get(ci); File[] pazienti = gruppi.get(ci);
                    publish("Cartella: " + root.getName());
                    for (File paz : pazienti) {
                        if (isCancelled()) break;
                        elab++;
                        publish("Paziente " + elab + "/" + tot + ": " + paz.getName());
                        setProgress(Math.min((int)(elab*100.0/tot), 99));
                        PatientResult pr = cercaPaziente(paz, paz.getName(), root.getName(), cfg);
                        if (pr != null && !pr.pdfPositivi.isEmpty()) risultati.add(pr);
                    }
                }
                return risultati;
            }

            private PatientResult cercaPaziente(File cartella, String nome, String nomeRoot, SearchConfig cfg) {
                File[] pdfs = cartella.listFiles(f -> f.getName().toLowerCase().endsWith(".pdf"));
                if (pdfs == null || pdfs.length == 0) return null;
                Arrays.sort(pdfs, (a,b) -> {
                    Date da = estraiData(a), db = estraiData(b);
                    if (da==null&&db==null) return a.getName().compareTo(b.getName());
                    if (da==null) return 1; if (db==null) return -1;
                    return da.compareTo(db);
                });
                PatientResult pr = new PatientResult(nome, nomeRoot);
                Set<String> trovatiTot = new HashSet<>();
                for (File pdf : pdfs) {
                    if (isCancelled()) break;
                    Date dataPdf = estraiData(pdf);
                    if (!inRange(dataPdf, cfg.dataInizio, cfg.dataFine)) continue;
                    String testo;
                    try { testo = estraiTesto(pdf, cfg.lettura, cfg.nPagine); }
                    catch (Exception ex) { publish("  [!] Non leggibile: " + pdf.getName()); continue; }
                    if (testo == null || testo.isEmpty()) continue;
                    String testoL = testo.toLowerCase(Locale.ITALIAN);
                    if (cfg.logicaAnd) {
                        boolean tuttiOk = cfg.termini.stream().allMatch(t -> testoL.contains(t.toLowerCase(Locale.ITALIAN)));
                        if (tuttiOk) {
                            pr.pdfPositivi.add(pdf); pr.terminiPerPDF.add(new ArrayList<>(cfg.termini));
                            if (cfg.stopAlPrimo) return pr;
                        }
                    } else {
                        List<String> trovatiQui = new ArrayList<>();
                        for (String t : cfg.termini)
                            if (testoL.contains(t.toLowerCase(Locale.ITALIAN))) { trovatiQui.add(t); trovatiTot.add(t.toLowerCase(Locale.ITALIAN)); }
                        if (!trovatiQui.isEmpty()) {
                            pr.pdfPositivi.add(pdf); pr.terminiPerPDF.add(trovatiQui);
                            if (cfg.stopAlPrimo) {
                                if (!cfg.orStopperTutti) return pr;
                                if (trovatiTot.size() >= cfg.termini.size()) return pr;
                            }
                        }
                    }
                }
                return pr;
            }

            @Override protected void process(List<String> chunks) {
                if (!chunks.isEmpty()) {
                    String s = chunks.get(chunks.size()-1);
                    lblStatus.setText(s);
                    progressBar.setString(s.length()>60 ? s.substring(0,60)+"..." : s);
                }
            }

            @Override protected void done() {
                btnCerca.setEnabled(true); btnAnnulla.setEnabled(false); progressBar.setValue(100);
                if (isCancelled()) { progressBar.setString("Annullato."); lblStatus.setText("Ricerca annullata."); return; }
                try { mostraRisultati(get()); }
                catch (Exception ex) { progressBar.setString("Errore."); lblStatus.setText("Errore: "+ex.getMessage()); }
            }
        }

        // ---------- estrazione testo PDF ----------

        private String estraiTesto(File f, LetturaMode mode, int nPag) throws IOException {
            try (PDDocument doc = PDDocument.load(f)) {
                int n = doc.getNumberOfPages(); if (n==0) return "";
                PDFTextStripper s = new PDFTextStripper(); s.setSortByPosition(true);
                if (mode == LetturaMode.INIZIO) { s.setStartPage(1); s.setEndPage(n); return s.getText(doc); }
                else if (mode == LetturaMode.FINE) {
                    StringBuilder sb = new StringBuilder();
                    for (int pg=n; pg>=1; pg--) { s.setStartPage(pg); s.setEndPage(pg); sb.append(s.getText(doc)); }
                    return sb.toString();
                } else {
                    s.setStartPage(Math.max(1, n-nPag+1)); s.setEndPage(n); return s.getText(doc);
                }
            }
        }

        // ---------- data da nome file ----------

        private static final SimpleDateFormat[] DATE_FMTS = {
            new SimpleDateFormat("yyyyMMdd"), new SimpleDateFormat("yyyy-MM-dd"),
            new SimpleDateFormat("yyyy_MM_dd"), new SimpleDateFormat("dd-MM-yyyy"),
            new SimpleDateFormat("dd_MM_yyyy"), new SimpleDateFormat("dd.MM.yyyy")
        };
        static { for (SimpleDateFormat f : DATE_FMTS) f.setLenient(false); }

        Date estraiData(File f) {
            String nome = f.getName().replaceFirst("\\.pdf$", "");
            for (int len : new int[]{10,8}) {
                for (int i=0; i<=nome.length()-len; i++) {
                    String sub = nome.substring(i, i+len);
                    for (SimpleDateFormat fmt : DATE_FMTS) {
                        try { return fmt.parse(sub); } catch (ParseException ignored) {}
                    }
                }
            }
            long ts = f.lastModified(); return ts>0 ? new Date(ts) : null;
        }

        boolean inRange(Date d, Date in, Date fin) {
            if (d==null) return true;
            if (in!=null && d.before(in)) return false;
            if (fin!=null) {
                Calendar c = Calendar.getInstance(); c.setTime(fin);
                c.set(Calendar.HOUR_OF_DAY,23); c.set(Calendar.MINUTE,59); c.set(Calendar.SECOND,59);
                if (d.after(c.getTime())) return false;
            }
            return true;
        }

        // ---------- visualizzazione risultati ----------

        void mostraRisultati(List<PatientResult> lista) {
            pnlRisultati.removeAll();
            int n = lista.size();
            JPanel hdr = new JPanel(new BorderLayout());
            hdr.setBackground(new Color(240,245,255));
            hdr.setBorder(new EmptyBorder(6,8,6,8));
            JLabel lh = new JLabel(String.format("<html><b>%d paziente/i POSITIVO/I</b></html>", n));
            lh.setForeground(n>0 ? VERDE : ROSSO);
            hdr.add(lh); hdr.setMaximumSize(new Dimension(Integer.MAX_VALUE,40));
            pnlRisultati.add(hdr);
            if (lista.isEmpty()) {
                JLabel l = new JLabel("   Nessun paziente positivo trovato.");
                l.setForeground(ROSSO); l.setBorder(new EmptyBorder(10,10,10,10));
                pnlRisultati.add(l);
            } else {
                for (int i=0; i<lista.size(); i++) {
                    pnlRisultati.add(buildRigaPaziente(lista.get(i), i));
                    JSeparator sep = new JSeparator(); sep.setMaximumSize(new Dimension(Integer.MAX_VALUE,1));
                    pnlRisultati.add(sep);
                }
            }
            pnlRisultati.add(Box.createVerticalGlue());
            pnlRisultati.revalidate(); pnlRisultati.repaint();
            lblStatus.setText(n + " paziente/i positivo/i.");
            progressBar.setString(n + " paziente/i trovato/i.");
        }

        private JPanel buildRigaPaziente(PatientResult pr, int idx) {
            JPanel p = new JPanel(); p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
            p.setBorder(new EmptyBorder(6,8,6,8));
            p.setBackground(idx%2==0 ? Color.WHITE : new Color(248,250,255));
            p.add(new JLabel(String.format("<html><b style='color:#005396;'>%s</b>&nbsp;&nbsp;<span style='color:#888;font-size:10px;'>[%s]</span>&nbsp;&nbsp;<span style='color:#006400;'>%d PDF positivo/i</span></html>",
                    esc(pr.nomePaziente), esc(pr.nomeCartella), pr.pdfPositivi.size())));
            p.add(vspace(4));
            for (int j=0; j<pr.pdfPositivi.size(); j++) {
                File pdfFile = pr.pdfPositivi.get(j);
                List<String> trv = pr.terminiPerPDF.get(j);
                JPanel row = new JPanel(new FlowLayout(FlowLayout.LEFT,4,0)); row.setOpaque(false);
                row.setAlignmentX(LEFT_ALIGNMENT);
                JButton btn = new JButton("<html><u>"+esc(pdfFile.getName())+"</u></html>");
                btn.setForeground(new Color(0,70,200)); btn.setBorderPainted(false);
                btn.setContentAreaFilled(false); btn.setCursor(new Cursor(Cursor.HAND_CURSOR));
                btn.setFont(btn.getFont().deriveFont(Font.PLAIN, 12f));
                btn.setToolTipText(pdfFile.getAbsolutePath());
                btn.addActionListener(e -> apriFile(pdfFile));
                Date d = estraiData(pdfFile);
                String ds = d!=null ? " ("+new SimpleDateFormat("dd/MM/yyyy").format(d)+")": "";
                row.add(new JLabel("   ")); row.add(btn);
                row.add(new JLabel("<html><span style='color:#555;'>" + esc(ds) + " &mdash; trovato: " + esc(String.join(", ", trv)) + "</span></html>"));
                p.add(row);
            }
            p.setMaximumSize(new Dimension(Integer.MAX_VALUE, p.getPreferredSize().height+20));
            return p;
        }

        void apriFile(File f) {
            try { Desktop.getDesktop().open(f); }
            catch (Exception ex) {
                StringSelection sel = new StringSelection(f.getAbsolutePath());
                Toolkit.getDefaultToolkit().getSystemClipboard().setContents(sel,null);
                JOptionPane.showMessageDialog(frame, "Impossibile aprire automaticamente.\nPercorso copiato negli appunti:\n"+f.getAbsolutePath(), "Apri manualmente", JOptionPane.INFORMATION_MESSAGE);
            }
        }

        // ---------- preferenze ----------

        void savePrefs() {
            Properties p = new Properties();
            p.setProperty("pdf.medici", txtDiarMedici.getText());
            p.setProperty("pdf.inf", txtDiarInf.getText());
            p.setProperty("pdf.termini", txtTermini.getText());
            p.setProperty("pdf.logica", rbAnd.isSelected()?"AND":"OR");
            p.setProperty("pdf.dataIn", txtDataInizio.getText());
            p.setProperty("pdf.dataFin", txtDataFine.getText());
            p.setProperty("pdf.lettura", rbInizio.isSelected()?"I": rbFine.isSelected()?"F":"U");
            p.setProperty("pdf.npag", spinPagine.getValue().toString());
            p.setProperty("pdf.stop", rbStopPrimo.isSelected()?"P":"T");
            p.setProperty("pdf.orStop", rbOrTutti.isSelected()?"T":"Q");
            try (FileOutputStream fos = new FileOutputStream(PREFS_FILE)) { p.store(fos,""); } catch (IOException ignored) {}
        }

        void loadPrefs() {
            File f = new File(PREFS_FILE); if (!f.exists()) return;
            Properties p = new Properties();
            try (FileInputStream fis = new FileInputStream(f)) {
                p.load(fis);
                txtDiarMedici.setText(p.getProperty("pdf.medici",""));
                txtDiarInf.setText(p.getProperty("pdf.inf",""));
                txtTermini.setText(p.getProperty("pdf.termini",""));
                if ("OR".equals(p.getProperty("pdf.logica"))) rbOr.setSelected(true);
                txtDataInizio.setText(p.getProperty("pdf.dataIn",""));
                txtDataFine.setText(p.getProperty("pdf.dataFin",""));
                String l = p.getProperty("pdf.lettura","I");
                if ("F".equals(l)) rbFine.setSelected(true); else if ("U".equals(l)) rbUltime.setSelected(true);
                try { spinPagine.setValue(Integer.parseInt(p.getProperty("pdf.npag","2"))); } catch (Exception ignored) {}
                if ("T".equals(p.getProperty("pdf.stop"))) rbStopTutti.setSelected(true);
                if ("T".equals(p.getProperty("pdf.orStop"))) rbOrTutti.setSelected(true);
            } catch (IOException ignored) {}
            aggiornaOrStopper();
        }

        // ---------- utility ----------

        List<String> parseTermini(String raw) {
            List<String> l = new ArrayList<>();
            for (String t : raw.split(",")) { String s = t.trim(); if (!s.isEmpty()) l.add(s); }
            return l;
        }
        Date parseData(String s) throws ParseException {
            SimpleDateFormat f = new SimpleDateFormat("dd/MM/yyyy"); f.setLenient(false); return f.parse(s);
        }
        void err(String msg) { JOptionPane.showMessageDialog(frame, msg, "Attenzione", JOptionPane.WARNING_MESSAGE); }
    }


    // #########################################################################
    // TAB 2 — PARAMETRI VITALI OCR
    // #########################################################################

    static class PannelloParametriVitali extends JPanel {

        private final RicercaDiari frame;

        // Dati del paziente corrente
        private String nomePazienteCorrente = "";
        private final List<String> colonneOre       = new ArrayList<>();  // es. "08:00", "09:00"
        private final Map<String,List<String>> datiParametri = new LinkedHashMap<>();

        // Lista pazienti salvati
        private final List<PatientVitals> archivio = new ArrayList<>();

        // GUI — sezione immagine
        private final JLabel lblPreview      = new JLabel("Nessuna immagine caricata", SwingConstants.CENTER);
        private BufferedImage imgCorrente    = null;

        // GUI — stato e controlli
        private final JLabel lblNomePaziente = new JLabel("Nessun paziente — clicca 'Nuovo Paziente'");
        private final JTextField txtAPIKey   = new JTextField("helloworld", 14);
        private final JLabel lblStatus       = new JLabel("In attesa di uno screenshot.");
        private final JProgressBar pbOCR     = new JProgressBar();

        // GUI — tabella parametri
        private final DefaultTableModel modelTabella = new DefaultTableModel() {
            @Override public boolean isCellEditable(int r, int c) { return c > 0; }
        };
        private final JTable tblParametri = new JTable(modelTabella);

        // GUI — raw OCR
        private final JTextArea txtRawOCR = new JTextArea(5, 40);

        // GUI — archivio
        private final DefaultListModel<String> listModel = new DefaultListModel<>();
        private final JList<String> listArchivio = new JList<>(listModel);

        PannelloParametriVitali(RicercaDiari frame) {
            this.frame = frame;
            setLayout(new BorderLayout(0, 0));
            add(buildNord(), BorderLayout.NORTH);
            add(buildCentro(), BorderLayout.CENTER);
            add(buildSud(), BorderLayout.SOUTH);
        }

        // ---- costruzione pannelli ----

        private JPanel buildNord() {
            JPanel p = new JPanel(new BorderLayout(8, 0));
            p.setBorder(new EmptyBorder(8,10,6,10));
            p.setBackground(new Color(230,240,255));

            // Pannello paziente
            JPanel pPaz = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 4));
            pPaz.setOpaque(false);
            pPaz.add(new JLabel("Paziente corrente: "));
            lblNomePaziente.setFont(new Font("SansSerif", Font.BOLD, 13));
            lblNomePaziente.setForeground(BLU);
            pPaz.add(lblNomePaziente);

            JButton btnNuovo = new JButton("Nuovo Paziente");
            btnNuovo.addActionListener(e -> nuovoPaziente(true));
            pPaz.add(btnNuovo);

            // Pannello API key
            JPanel pAPI = new JPanel(new FlowLayout(FlowLayout.RIGHT, 6, 4));
            pAPI.setOpaque(false);
            pAPI.add(new JLabel("API Key OCR.Space:"));
            pAPI.add(txtAPIKey);
            JLabel lnk = new JLabel("<html><a href=''>Ottieni chiave gratuita</a></html>");
            lnk.setCursor(new Cursor(Cursor.HAND_CURSOR));
            lnk.setToolTipText("https://ocr.space/ocrapi");
            lnk.addMouseListener(new MouseAdapter() {
                @Override public void mouseClicked(MouseEvent e) {
                    try { Desktop.getDesktop().browse(new URI("https://ocr.space/ocrapi")); }
                    catch (Exception ignored) {}
                }
            });
            pAPI.add(lnk);

            p.add(pPaz, BorderLayout.WEST);
            p.add(pAPI, BorderLayout.EAST);
            return p;
        }

        private JSplitPane buildCentro() {
            // Pannello sinistro: screenshot + controlli OCR
            JPanel pSx = new JPanel(new BorderLayout(0,6));
            pSx.setBorder(new EmptyBorder(8,10,8,5));

            // Area preview immagine
            lblPreview.setPreferredSize(new Dimension(340, 240));
            lblPreview.setMinimumSize(new Dimension(220, 160));
            lblPreview.setBorder(BorderFactory.createLineBorder(Color.LIGHT_GRAY));
            lblPreview.setBackground(new Color(245,245,250));
            lblPreview.setOpaque(true);
            JScrollPane spImg = new JScrollPane(lblPreview);
            spImg.setPreferredSize(new Dimension(340, 240));
            pSx.add(spImg, BorderLayout.CENTER);

            // Bottoni caricamento
            JPanel pBtn = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 2));
            JButton btnFile    = new JButton("Sfoglia file immagine...");
            JButton btnIncolla = new JButton("Incolla dagli Appunti (Ctrl+V)");
            JButton btnOCR     = new JButton("  Esegui OCR  ");
            btnOCR.setBackground(BLU); btnOCR.setForeground(Color.WHITE);
            btnOCR.setFont(new Font("SansSerif", Font.BOLD, 12)); btnOCR.setFocusPainted(false);
            btnFile.addActionListener(e -> caricaDaFile());
            btnIncolla.addActionListener(e -> caricaDaClipboard());
            btnOCR.addActionListener(e -> avviaOCR());
            pBtn.add(btnFile); pBtn.add(btnIncolla); pBtn.add(btnOCR);
            pSx.add(pBtn, BorderLayout.NORTH);

            // Raw OCR + status
            JPanel pRaw = new JPanel(new BorderLayout());
            pRaw.setBorder(titledPanel("Testo grezzo OCR (modificabile)").getBorder());
            txtRawOCR.setFont(new Font("Monospaced", Font.PLAIN, 11));
            txtRawOCR.setLineWrap(true);
            JScrollPane spRaw = new JScrollPane(txtRawOCR);
            spRaw.setPreferredSize(new Dimension(340, 120));
            pRaw.add(spRaw, BorderLayout.CENTER);
            JButton btnRiparse = new JButton("Aggiorna tabella dal testo modificato");
            btnRiparse.addActionListener(e -> parsaEAggiungiColonne(txtRawOCR.getText()));
            pRaw.add(btnRiparse, BorderLayout.SOUTH);
            pSx.add(pRaw, BorderLayout.SOUTH);

            // Pannello destro: tabella + archivio
            JPanel pDx = new JPanel(new BorderLayout(0,6));
            pDx.setBorder(new EmptyBorder(8,5,8,10));

            // Tabella parametri
            tblParametri.setAutoResizeMode(JTable.AUTO_RESIZE_OFF);
            tblParametri.setRowHeight(22);
            tblParametri.setFont(new Font("SansSerif", Font.PLAIN, 12));
            tblParametri.getTableHeader().setFont(new Font("SansSerif", Font.BOLD, 12));
            tblParametri.setGridColor(new Color(200,210,230));
            tblParametri.setShowGrid(true);
            // Colonna 0 (nome parametro) — sfondo diverso
            tblParametri.setDefaultRenderer(Object.class, new DefaultTableCellRenderer() {
                @Override
                public Component getTableCellRendererComponent(JTable t, Object v, boolean sel, boolean foc, int r, int c) {
                    Component comp = super.getTableCellRendererComponent(t,v,sel,foc,r,c);
                    if (!sel) {
                        if (c == 0) { comp.setBackground(new Color(220,232,255)); comp.setForeground(new Color(0,50,120)); }
                        else { comp.setBackground(r%2==0 ? Color.WHITE : new Color(245,248,255)); comp.setForeground(Color.BLACK); }
                    }
                    return comp;
                }
            });
            JScrollPane spTabella = new JScrollPane(tblParametri);
            spTabella.setPreferredSize(new Dimension(480, 300));

            JPanel pTblControlli = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 2));
            JButton btnEsportaCSV = new JButton("Esporta CSV");
            JButton btnSvuota     = new JButton("Svuota tabella paziente");
            btnEsportaCSV.addActionListener(e -> esportaCSV());
            btnSvuota.addActionListener(e -> {
                if (JOptionPane.showConfirmDialog(frame, "Svuotare la tabella del paziente corrente?",
                        "Conferma", JOptionPane.YES_NO_OPTION) == JOptionPane.YES_OPTION) {
                    svuotaTabella();
                }
            });
            pTblControlli.add(btnEsportaCSV); pTblControlli.add(btnSvuota);

            JPanel pTabella = new JPanel(new BorderLayout());
            pTabella.setBorder(titledPanel("Tabella Parametri Vitali").getBorder());
            pTabella.add(spTabella, BorderLayout.CENTER);
            pTabella.add(pTblControlli, BorderLayout.SOUTH);
            pDx.add(pTabella, BorderLayout.CENTER);

            // Archivio pazienti
            JPanel pArchivio = new JPanel(new BorderLayout());
            pArchivio.setBorder(titledPanel("Pazienti elaborati").getBorder());
            listArchivio.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
            listArchivio.addMouseListener(new MouseAdapter() {
                @Override public void mouseClicked(MouseEvent e) {
                    if (e.getClickCount()==2) caricaDaArchivio(listArchivio.getSelectedIndex());
                }
            });
            pArchivio.add(new JScrollPane(listArchivio), BorderLayout.CENTER);
            pArchivio.setPreferredSize(new Dimension(480, 100));
            pDx.add(pArchivio, BorderLayout.SOUTH);

            JSplitPane split = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, pSx, pDx);
            split.setDividerLocation(370);
            split.setResizeWeight(0.4);
            return split;
        }

        private JPanel buildSud() {
            JPanel p = new JPanel(new BorderLayout(8,0));
            p.setBorder(new EmptyBorder(4,10,6,10));
            p.setBackground(new Color(245,248,255));
            pbOCR.setStringPainted(true); pbOCR.setString(""); pbOCR.setPreferredSize(new Dimension(200,18));
            lblStatus.setFont(new Font("SansSerif", Font.PLAIN, 11));
            p.add(pbOCR, BorderLayout.WEST);
            p.add(lblStatus, BorderLayout.CENTER);
            return p;
        }

        // ---- caricamento immagine ----

        private void caricaDaFile() {
            JFileChooser fc = new JFileChooser(System.getProperty("user.home"));
            fc.setDialogTitle("Seleziona screenshot della tabella parametri");
            fc.setFileFilter(new javax.swing.filechooser.FileFilter() {
                @Override public boolean accept(File f) {
                    String n = f.getName().toLowerCase();
                    return f.isDirectory() || n.endsWith(".png") || n.endsWith(".jpg")
                            || n.endsWith(".jpeg") || n.endsWith(".bmp") || n.endsWith(".gif");
                }
                @Override public String getDescription() { return "Immagini (PNG, JPG, BMP, GIF)"; }
            });
            if (fc.showOpenDialog(frame) == JFileChooser.APPROVE_OPTION) {
                try {
                    imgCorrente = ImageIO.read(fc.getSelectedFile());
                    if (imgCorrente == null) { err("Impossibile leggere l'immagine selezionata."); return; }
                    mostraPreview(imgCorrente);
                    lblStatus.setText("Immagine caricata: " + fc.getSelectedFile().getName() + " — premi 'Esegui OCR'");
                } catch (IOException ex) { err("Errore nella lettura del file: " + ex.getMessage()); }
            }
        }

        private void caricaDaClipboard() {
            try {
                Transferable t = Toolkit.getDefaultToolkit().getSystemClipboard().getContents(null);
                if (t != null && t.isDataFlavorSupported(DataFlavor.imageFlavor)) {
                    Image img = (Image) t.getTransferData(DataFlavor.imageFlavor);
                    imgCorrente = toBufferedImage(img);
                    mostraPreview(imgCorrente);
                    lblStatus.setText("Immagine incollata dagli appunti — premi 'Esegui OCR'");
                } else {
                    err("Nessuna immagine negli appunti.\nCopiate prima la schermata con Stamp (PrtSc) o uno strumento di ritaglio.");
                }
            } catch (Exception ex) { err("Errore nel leggere gli appunti: " + ex.getMessage()); }
        }

        private void mostraPreview(BufferedImage img) {
            // Scala l'immagine mantenendo le proporzioni
            int maxW = 320, maxH = 220;
            double ratio = Math.min((double)maxW/img.getWidth(), (double)maxH/img.getHeight());
            int w = (int)(img.getWidth()*ratio), h = (int)(img.getHeight()*ratio);
            Image scaled = img.getScaledInstance(w, h, Image.SCALE_SMOOTH);
            lblPreview.setIcon(new ImageIcon(scaled));
            lblPreview.setText(null);
        }

        private BufferedImage toBufferedImage(Image img) {
            if (img instanceof BufferedImage) return (BufferedImage) img;
            BufferedImage bi = new BufferedImage(img.getWidth(null), img.getHeight(null), BufferedImage.TYPE_INT_RGB);
            Graphics2D g2 = bi.createGraphics();
            g2.drawImage(img,0,0,null); g2.dispose();
            return bi;
        }

        // ---- OCR ----

        private void avviaOCR() {
            if (imgCorrente == null) { err("Carica prima uno screenshot."); return; }
            String apiKey = txtAPIKey.getText().trim();
            if (apiKey.isEmpty()) apiKey = "helloworld";
            final String key = apiKey;

            pbOCR.setIndeterminate(true);
            pbOCR.setString("Invio immagine a OCR.Space...");
            lblStatus.setText("Analisi OCR in corso — attendere...");

            SwingWorker<String,Void> worker = new SwingWorker<String,Void>() {
                @Override protected String doInBackground() throws Exception {
                    return callOCRSpace(imgCorrente, key);
                }
                @Override protected void done() {
                    pbOCR.setIndeterminate(false); pbOCR.setString("");
                    try {
                        String json = get();
                        String testo = estraiTestoDaJSON(json);
                        if (testo == null || testo.trim().isEmpty()) {
                            // Mostra errore dal JSON
                            String errMsg = estraiErroreDaJSON(json);
                            err("OCR non ha restituito testo.\n" + (errMsg!=null ? errMsg : "Controlla la chiave API e la connessione."));
                            lblStatus.setText("OCR fallito.");
                            return;
                        }
                        txtRawOCR.setText(testo);
                        chiediPazienteEAggiungi(testo);
                    } catch (Exception ex) {
                        err("Errore durante l'OCR:\n" + ex.getMessage());
                        lblStatus.setText("Errore OCR: " + ex.getMessage());
                    }
                }
            };
            worker.execute();
        }

        /** Chiede all'utente se aggiungere al paziente corrente o crearne uno nuovo, poi parsifica. */
        private void chiediPazienteEAggiungi(String testo) {
            if (nomePazienteCorrente.isEmpty()) {
                nuovoPaziente(false);
            } else {
                String[] opzioni = {
                    "Aggiungi a: " + nomePazienteCorrente,
                    "Nuovo paziente",
                    "Annulla"
                };
                int scelta = JOptionPane.showOptionDialog(frame,
                        "Aggiungere questo screenshot al paziente corrente\n\"" + nomePazienteCorrente + "\"\noppure iniziare un nuovo paziente?",
                        "Destinazione screenshot",
                        JOptionPane.DEFAULT_OPTION, JOptionPane.QUESTION_MESSAGE, null, opzioni, opzioni[0]);
                if (scelta == 2 || scelta < 0) return;
                if (scelta == 1) nuovoPaziente(false);
            }
            parsaEAggiungiColonne(testo);
        }

        private void nuovoPaziente(boolean salvaCorrente) {
            if (salvaCorrente && !nomePazienteCorrente.isEmpty() && !datiParametri.isEmpty()) {
                salvaInArchivio();
            }
            String nome = JOptionPane.showInputDialog(frame, "Nome / ID del paziente:", "Nuovo paziente", JOptionPane.PLAIN_MESSAGE);
            if (nome == null || nome.trim().isEmpty()) nome = "Paziente " + (archivio.size()+1);
            nomePazienteCorrente = nome.trim();
            svuotaTabella();
            lblNomePaziente.setText(nomePazienteCorrente);
            lblStatus.setText("Paziente: " + nomePazienteCorrente + " — carica uno screenshot.");
        }

        private void svuotaTabella() {
            colonneOre.clear(); datiParametri.clear();
            modelTabella.setRowCount(0); modelTabella.setColumnCount(0);
            modelTabella.addColumn("Parametro");
        }

        // ---- parsing OCR → tabella ----

        /**
         * Tenta di convertire il testo OCR in colonne per la tabella.
         * Ogni riga del testo diventa un parametro; i valori separati da spazi/tab
         * diventano letture orarie (nuove colonne).
         */
        private void parsaEAggiungiColonne(String testo) {
            if (testo == null || testo.trim().isEmpty()) return;

            // Chiedi data/ora della prima colonna di questo screenshot
            String oraInput = JOptionPane.showInputDialog(frame,
                    "Indicare l'ora della PRIMA colonna in questo screenshot:\n(es. 08:00 oppure 2024-06-15 08:00)\nLascia vuoto = numera automaticamente",
                    "Ora prima colonna", JOptionPane.PLAIN_MESSAGE);
            if (oraInput == null) return;
            oraInput = oraInput.trim();

            String[] righe = testo.split("\\n");
            // Prima passata: calcola il numero massimo di valori per riga
            int maxValori = 0;
            List<String[]> righeParseate = new ArrayList<>();
            for (String riga : righe) {
                riga = riga.trim();
                if (riga.isEmpty()) continue;
                // Splitta per tab o 2+ spazi
                String[] parti = riga.split("\\t|  +");
                if (parti.length >= 1 && !parti[0].trim().isEmpty()) {
                    righeParseate.add(parti);
                    if (parti.length - 1 > maxValori) maxValori = parti.length - 1;
                }
            }
            if (maxValori == 0) maxValori = 1;

            // Calcola le etichette delle nuove colonne
            int colonneEsistenti = colonneOre.size();
            List<String> nuoveEtichette = new ArrayList<>();
            for (int i = 0; i < maxValori; i++) {
                if (!oraInput.isEmpty()) {
                    nuoveEtichette.add(calcolaOra(oraInput, colonneEsistenti + i));
                } else {
                    nuoveEtichette.add("L" + (colonneEsistenti + i + 1));
                }
            }

            // Aggiungi colonne al model
            for (String et : nuoveEtichette) {
                colonneOre.add(et);
                modelTabella.addColumn(et);
            }

            // Popola righe
            for (String[] parti : righeParseate) {
                String nomePar = parti[0].trim()
                        .replaceAll("^[\\-–—\\*\\s]+","")
                        .replaceAll("[:\\s]+$","");
                if (nomePar.isEmpty()) continue;

                // Cerca riga esistente
                int rigaIdx = -1;
                for (int r = 0; r < modelTabella.getRowCount(); r++) {
                    Object v = modelTabella.getValueAt(r, 0);
                    if (v != null && v.toString().equalsIgnoreCase(nomePar)) { rigaIdx = r; break; }
                }
                if (rigaIdx == -1) {
                    // Nuova riga: riempie le colonne precedenti con "-"
                    Object[] nuovaRiga = new Object[modelTabella.getColumnCount()];
                    nuovaRiga[0] = nomePar;
                    for (int c = 1; c < nuovaRiga.length; c++) nuovaRiga[c] = "-";
                    modelTabella.addRow(nuovaRiga);
                    rigaIdx = modelTabella.getRowCount() - 1;
                    datiParametri.put(nomePar, new ArrayList<>());
                }

                // Riempie le nuove colonne
                int colStart = colonneEsistenti + 1; // +1 perché col 0 = nome parametro
                for (int i = 0; i < maxValori; i++) {
                    String val = (i + 1 < parti.length) ? parti[i+1].trim() : "-";
                    if (val.isEmpty()) val = "-";
                    int colIdx = colStart + i;
                    if (colIdx < modelTabella.getColumnCount()) {
                        modelTabella.setValueAt(val, rigaIdx, colIdx);
                    }
                }
                // Aggiorna mappa interna
                List<String> listaVal = datiParametri.getOrDefault(nomePar, new ArrayList<>());
                for (int i = 0; i < maxValori; i++) {
                    String val = (i + 1 < parti.length) ? parti[i+1].trim() : "-";
                    listaVal.add(val.isEmpty() ? "-" : val);
                }
                datiParametri.put(nomePar, listaVal);
            }

            // Aggiusta larghezze colonne
            tblParametri.getColumnModel().getColumn(0).setPreferredWidth(160);
            for (int c = 1; c < modelTabella.getColumnCount(); c++)
                tblParametri.getColumnModel().getColumn(c).setPreferredWidth(70);

            lblStatus.setText("Tabella aggiornata: " + datiParametri.size() + " parametri, " + colonneOre.size() + " letture.");
        }

        /** Calcola l'ora/etichetta aggiungendo 'offset' ore a una stringa di partenza. */
        private String calcolaOra(String base, int offsetOre) {
            // Cerca un pattern hh:mm nell'input
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d{1,2}):(\\d{2})").matcher(base);
            if (m.find()) {
                int h = Integer.parseInt(m.group(1)) + offsetOre;
                int min = Integer.parseInt(m.group(2));
                String prefisso = base.substring(0, m.start()).trim();
                return (prefisso.isEmpty() ? "" : prefisso+" ") + String.format("%02d:%02d", h%24, min);
            }
            return base + (offsetOre > 0 ? "+" + offsetOre + "h" : "");
        }

        // ---- OCR.Space API ----

        private String callOCRSpace(BufferedImage img, String apiKey) throws Exception {
            // Converti immagine in PNG base64
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(img, "png", baos);
            String b64 = "data:image/png;base64," +
                    Base64.getEncoder().encodeToString(baos.toByteArray());

            String boundary = "----OCRBoundary" + Long.toHexString(System.nanoTime());
            URL url = new URL("https://api.ocr.space/parse/image");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(20000); conn.setReadTimeout(60000);
            conn.setRequestMethod("POST"); conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);

            ByteArrayOutputStream bodyBuf = new ByteArrayOutputStream();
            PrintWriter pw = new PrintWriter(new OutputStreamWriter(bodyBuf, StandardCharsets.UTF_8), true);
            addField(pw, boundary, "apikey",           apiKey);
            addField(pw, boundary, "base64Image",      b64);
            addField(pw, boundary, "language",         "ita");
            addField(pw, boundary, "isTable",          "true");
            addField(pw, boundary, "OCREngine",        "2");
            addField(pw, boundary, "detectOrientation","true");
            pw.println("--" + boundary + "--");
            pw.flush();

            byte[] body = bodyBuf.toByteArray();
            conn.setRequestProperty("Content-Length", String.valueOf(body.length));
            try (OutputStream os = conn.getOutputStream()) { os.write(body); }

            InputStream is = conn.getResponseCode() == 200 ? conn.getInputStream() : conn.getErrorStream();
            if (is == null) return "{\"error\":\"Nessuna risposta dal server\"}";
            BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(); String line;
            while ((line = br.readLine()) != null) sb.append(line);
            return sb.toString();
        }

        private void addField(PrintWriter pw, String boundary, String name, String value) {
            pw.println("--" + boundary);
            pw.println("Content-Disposition: form-data; name=\"" + name + "\"");
            pw.println();
            pw.println(value);
        }

        /** Estrae ParsedText dalla risposta JSON di OCR.Space. */
        private String estraiTestoDaJSON(String json) {
            if (json == null) return null;
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("\"ParsedText\"\\s*:\\s*\"(.*?)\"(?=\\s*[,}])", java.util.regex.Pattern.DOTALL)
                    .matcher(json);
            if (m.find()) {
                return m.group(1)
                        .replace("\\r\\n","\n").replace("\\n","\n").replace("\\r","\n")
                        .replace("\\t","\t").replace("\\\"","\"").replace("\\\\","\\");
            }
            return null;
        }

        /** Estrae il messaggio di errore dal JSON di OCR.Space. */
        private String estraiErroreDaJSON(String json) {
            if (json == null) return null;
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("\"ErrorMessage\"\\s*:\\s*\\[?\\s*\"([^\"]+)\"")
                    .matcher(json);
            if (m.find()) return m.group(1);
            m = java.util.regex.Pattern.compile("\"Message\"\\s*:\\s*\"([^\"]+)\"").matcher(json);
            if (m.find()) return m.group(1);
            return null;
        }

        // ---- archivio pazienti ----

        private void salvaInArchivio() {
            // Aggiorna o aggiungi
            for (PatientVitals pv : archivio) {
                if (pv.nome.equals(nomePazienteCorrente)) {
                    pv.colonneOre = new ArrayList<>(colonneOre);
                    pv.dati = copyDati(); return;
                }
            }
            PatientVitals pv = new PatientVitals(nomePazienteCorrente, new ArrayList<>(colonneOre), copyDati());
            archivio.add(pv);
            listModel.addElement(nomePazienteCorrente + "  (" + colonneOre.size() + " letture)");
        }

        private Map<String,List<String>> copyDati() {
            Map<String,List<String>> copia = new LinkedHashMap<>();
            for (Map.Entry<String,List<String>> e : datiParametri.entrySet())
                copia.put(e.getKey(), new ArrayList<>(e.getValue()));
            return copia;
        }

        private void caricaDaArchivio(int idx) {
            if (idx < 0 || idx >= archivio.size()) return;
            if (!datiParametri.isEmpty()) {
                int r = JOptionPane.showConfirmDialog(frame,
                        "Salvare prima il paziente corrente nell'archivio?","Salva",JOptionPane.YES_NO_CANCEL_OPTION);
                if (r == JOptionPane.CANCEL_OPTION) return;
                if (r == JOptionPane.YES_OPTION) salvaInArchivio();
            }
            PatientVitals pv = archivio.get(idx);
            nomePazienteCorrente = pv.nome;
            lblNomePaziente.setText(nomePazienteCorrente);
            svuotaTabella();
            // Ricostruisci tabella
            colonneOre.addAll(pv.colonneOre);
            for (String col : colonneOre) modelTabella.addColumn(col);
            for (Map.Entry<String,List<String>> e : pv.dati.entrySet()) {
                Object[] row = new Object[modelTabella.getColumnCount()];
                row[0] = e.getKey();
                List<String> vals = e.getValue();
                for (int c = 0; c < colonneOre.size(); c++)
                    row[c+1] = c < vals.size() ? vals.get(c) : "-";
                modelTabella.addRow(row);
                datiParametri.put(e.getKey(), new ArrayList<>(vals));
            }
            tblParametri.getColumnModel().getColumn(0).setPreferredWidth(160);
            for (int c=1; c<modelTabella.getColumnCount(); c++) tblParametri.getColumnModel().getColumn(c).setPreferredWidth(70);
            lblStatus.setText("Caricato: " + nomePazienteCorrente);
        }

        // ---- esporta CSV ----

        private void esportaCSV() {
            if (modelTabella.getRowCount() == 0) { err("Nessun dato da esportare."); return; }
            JFileChooser fc = new JFileChooser(System.getProperty("user.home"));
            fc.setSelectedFile(new File(nomePazienteCorrente.replaceAll("[^\\w\\s-]","_") + "_parametri.csv"));
            if (fc.showSaveDialog(frame) != JFileChooser.APPROVE_OPTION) return;
            try (PrintWriter pw = new PrintWriter(new OutputStreamWriter(new FileOutputStream(fc.getSelectedFile()), StandardCharsets.UTF_8))) {
                // intestazione
                StringBuilder hdr = new StringBuilder("Parametro");
                for (String col : colonneOre) hdr.append(";").append(col);
                pw.println(hdr);
                // righe
                for (int r = 0; r < modelTabella.getRowCount(); r++) {
                    StringBuilder row = new StringBuilder();
                    for (int c = 0; c < modelTabella.getColumnCount(); c++) {
                        if (c > 0) row.append(";");
                        Object v = modelTabella.getValueAt(r, c);
                        row.append(v != null ? v.toString().replace(";",",") : "");
                    }
                    pw.println(row);
                }
                lblStatus.setText("CSV esportato: " + fc.getSelectedFile().getName());
                Desktop.getDesktop().open(fc.getSelectedFile().getParentFile());
            } catch (Exception ex) { err("Errore esportazione: " + ex.getMessage()); }
        }

        void err(String msg) { JOptionPane.showMessageDialog(frame, msg, "Attenzione", JOptionPane.WARNING_MESSAGE); }

        // ---- preferenze ----
        void savePrefs() {
            Properties p = new Properties();
            p.setProperty("ocr.apikey", txtAPIKey.getText());
            try (FileOutputStream fos = new FileOutputStream(PREFS_FILE, true)) {
                // Usiamo Properties separato per non sovrascrivere quelle PDF
            } catch (IOException ignored) {}
            // Salviamo tramite file dedicato per le prefs OCR
            try (FileOutputStream fos = new FileOutputStream(
                    System.getProperty("user.home") + File.separator + ".ricercadiariocr.properties")) {
                p.store(fos, "");
            } catch (IOException ignored) {}
        }
        void loadPrefs() {
            File f = new File(System.getProperty("user.home") + File.separator + ".ricercadiariocr.properties");
            if (!f.exists()) return;
            Properties p = new Properties();
            try (FileInputStream fis = new FileInputStream(f)) {
                p.load(fis);
                txtAPIKey.setText(p.getProperty("ocr.apikey", "helloworld"));
            } catch (IOException ignored) {}
        }
    }

    // #########################################################################
    // DATA CLASSES CONDIVISE
    // #########################################################################

    enum LetturaMode { INIZIO, FINE, ULTIME_N }

    static class SearchConfig {
        List<String> termini; boolean logicaAnd = true;
        Date dataInizio, dataFine;
        LetturaMode lettura = LetturaMode.INIZIO; int nPagine = 2;
        boolean stopAlPrimo = true, orStopperTutti = false;
    }

    static class PatientResult {
        final String nomePaziente, nomeCartella;
        final List<File> pdfPositivi         = new ArrayList<>();
        final List<List<String>> terminiPerPDF = new ArrayList<>();
        PatientResult(String n, String c) { nomePaziente=n; nomeCartella=c; }
    }

    static class PatientVitals {
        final String nome;
        List<String> colonneOre;
        Map<String,List<String>> dati;
        PatientVitals(String nome, List<String> colonneOre, Map<String,List<String>> dati) {
            this.nome=nome; this.colonneOre=colonneOre; this.dati=dati;
        }
    }
}
                                                                        