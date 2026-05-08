-- ============================================
-- Legacy Bookings — Historisk bokningsdata 2021–2027
-- ============================================

DROP TABLE IF EXISTS public.legacy_bookings CASCADE;

CREATE TABLE public.legacy_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  booked_by_name TEXT NOT NULL,
  reserve_name TEXT,
  type TEXT NOT NULL DEFAULT 'booking' CHECK (type IN ('booking', 'maintenance', 'cancelled', 'interest')),
  price INTEGER,
  paid TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.legacy_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Legacy: read all" ON public.legacy_bookings FOR SELECT USING (true);
CREATE POLICY "Legacy: admin manage" ON public.legacy_bookings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_legacy_year_week ON public.legacy_bookings(year, week_number);

-- ============================================
-- 2021
-- ============================================
INSERT INTO public.legacy_bookings (year, week_number, booked_by_name, type, price, notes) VALUES
(2021, 1,  'Peder Ivarsson, ÖM',                                   'booking',     1750, NULL),
(2021, 3,  'Gunnar Neselius, JO',                                  'booking',        0, 'Ej betalande'),
(2021, 4,  'Ronny Rylander, Fd Katarina',                          'booking',     1750, NULL),
(2021, 5,  'VVS-arbete: Anders, Raska Rör',                        'maintenance',    0, '073-803 00 66, Gunnar Neselius'),
(2021, 6,  'Reservtid VVS-arbete',                                 'maintenance',    0, NULL),
(2021, 7,  'Gunnar Neselius, JO',                                  'booking',        0, NULL),
(2021, 8,  'Henrik Harrling, KT',                                  'booking',     1750, NULL),
(2021, 9,  'David Justesen, ÅB',                                   'booking',     2800, NULL),
(2021, 10, 'Jens Molin, BK / Göran Stark',                         'booking',     1000, 'lör 6/3–ons 10/3: Jens Molin; ons 10/3–17/3: Göran Stark'),
(2021, 11, 'Göran Stark / Peder Ivarsson, ÖM',                     'booking',     1000, 'ons 10/3–17/3: Göran Stark; ons 17/3–lör 20/3: Peder Ivarsson'),
(2021, 12, 'Ann Fosyth, AISAB',                                    'booking',     1750, NULL),
(2021, 13, 'Marcus Carlsson, VA',                                  'booking',     2800, NULL),
(2021, 14, 'Niklas Andersson, JO',                                 'booking',     2800, NULL),
(2021, 15, 'Gunnar Neselius, JO',                                  'booking',        0, NULL),
(2021, 16, 'Kristian Björndalen',                                  'booking',     1750, NULL),
(2021, 17, 'VVS-arbete / Lars Golvmatta / Stefan Bergström, Hede Plåt', 'maintenance', 0, '073-803 00 66; 0703-35 50 10'),
(2021, 18, 'Kjell Bergqvist',                                      'booking',     1750, NULL),
(2021, 19, 'Marcus Carlsson A72',                                  'booking',     1000, 'ons 12/5–lör 15/5'),
(2021, 20, 'VVS-arbete Raska Rör och mattläggare',                 'maintenance',    0, '3:e försöket'),
(2021, 24, 'Anders Honken Holmqvist',                              'booking',     NULL, NULL),
(2021, 26, 'Kristian Björndalen',                                  'booking',     1000, 'ons 30/6–sön 3/7'),
(2021, 27, 'Magnus Kark, JO',                                      'booking',     1750, NULL),
(2021, 28, 'Jens Molin',                                           'booking',     1000, '10/7–14/7; David Justesen avbokad 15–24 juli'),
(2021, 29, 'David Justesen, ÅB',                                   'cancelled',   1750, 'Avbokad 15–24 juli'),
(2021, 30, 'Pelle Harju',                                          'booking',     1750, NULL),
(2021, 31, 'Pelle Harju',                                          'booking',     1750, NULL),
(2021, 32, 'Hasse Eriksson',                                       'booking',     1750, 'Niklas Andersson, JO avbokat'),
(2021, 33, 'Rebecka Delldén',                                      'booking',     1750, NULL),
(2021, 34, 'Tommy Johansson, pensionär',                           'booking',     1750, NULL),
(2021, 37, 'Projekt nytt kök',                                     'maintenance',    0, NULL),
(2021, 38, 'Projekt nytt kök',                                     'maintenance',    0, NULL),
(2021, 39, 'Projekt nytt kök',                                     'maintenance',    0, NULL),
(2021, 40, 'Projekt nytt kök / Patrik',                            'maintenance',    0, '4–8/10'),
(2021, 41, 'Projekt nytt kök',                                     'maintenance',    0, NULL),
(2021, 45, 'Stefan',                                               'booking',     NULL, '10–17 november'),
(2021, 51, 'Gunnar Neselius, JO',                                  'booking',        0, NULL),
(2021, 52, 'Johan Aarnio ÖM',                                      'booking',     NULL, NULL);

-- ============================================
-- 2022
-- ============================================
INSERT INTO public.legacy_bookings (year, week_number, booked_by_name, type, price, notes) VALUES
(2022, 1,  'Peter Lindgren KT',                    'booking',     NULL, NULL),
(2022, 4,  'Jens Molin / Stefan Andersson',        'booking',     NULL, '26/1–29/1: Jens Molin; 29/1–2/2: Stefan Andersson'),
(2022, 5,  'Kristian Björndahl',                   'booking',     NULL, '2/2–5/2'),
(2022, 6,  'Ann Forsyth, Lidingö Amb.',            'booking',     1750, NULL),
(2022, 7,  'Ronny Rylander, fd Katarina',          'booking',     1750, NULL),
(2022, 8,  'Alexander Oxeldal, KH',                'booking',     1750, NULL),
(2022, 9,  'David Justesen ÅB',                    'booking',     NULL, 'Byte till Anders Honken Holmqvist'),
(2022, 10, 'Gunnar Neselius, JO',                  'booking',     NULL, NULL),
(2022, 11, 'Johan Kroon, TÄ',                      'booking',     NULL, NULL),
(2022, 12, 'Göran Stark, KT',                      'booking',     NULL, NULL),
(2022, 13, 'Torbjörn Forslund, VA',                'booking',     NULL, NULL),
(2022, 14, 'Patrik Gustavsson, LÖ',               'booking',     NULL, NULL),
(2022, 15, 'Peder Ivarsson ÖM',                    'booking',     NULL, NULL),
(2022, 16, 'Håkan Arkeving, LÖ',                   'booking',     NULL, 'Överlät till Gunnar Neselius'),
(2022, 17, 'Kjell Bergkvist, fd 213',              'booking',     NULL, NULL),
(2022, 21, 'Mälarn',                               'booking',     NULL, '25–31/5'),
(2022, 22, 'Mälarn',                               'booking',     NULL, '25–31/5'),
(2022, 23, 'Anders Honken Holmqvist',              'booking',     NULL, '4–11/6'),
(2022, 27, 'Magnus Kark',                          'booking',     NULL, NULL),
(2022, 28, 'Pelle Harju',                          'booking',     NULL, '9–20/7'),
(2022, 29, 'Pelle Harju',                          'booking',     NULL, '9–20/7 (Lina 20–23?)'),
(2022, 30, 'Jonas Krantz, JO',                     'booking',     NULL, NULL),
(2022, 31, 'Liisa Honkaranta, JO',                 'booking',     NULL, NULL),
(2022, 34, 'Johan Kroon, TÄ',                      'booking',     NULL, 'Återkommer om datum'),
(2022, 36, 'Alexander Meurman, ÅB',                'booking',     NULL, '7–10/9'),
(2022, 37, 'Joakim Bäcklin',                       'booking',     NULL, '11–17/9?'),
(2022, 41, 'Peter Lindgren KT',                    'booking',     NULL, 'fd 318'),
(2022, 46, 'Gunnar Neselius, JO',                  'maintenance', NULL, 'Arbete 27–29/11'),
(2022, 50, 'Gunnar Neselius, JO',                  'booking',     NULL, 'fr ons?'),
(2022, 51, 'Gunnar Neselius, JO',                  'booking',     NULL, NULL),
(2022, 52, 'Johan Aarnio, ÖM',                     'booking',     NULL, NULL);

-- ============================================
-- 2023
-- ============================================
INSERT INTO public.legacy_bookings (year, week_number, booked_by_name, type, paid, notes) VALUES
(2023, 1,  'Anders Honken Holmqvist, SO', 'booking', NULL,       NULL),
(2023, 2,  'Jesper Lindström',            'booking', NULL,       NULL),
(2023, 3,  'Gunnar Neselius (helg GNE)',  'booking', NULL,       'helg'),
(2023, 5,  'Niklas Bergström, FA',        'booking', NULL,       NULL),
(2023, 7,  'Gunnar Neselius, JO',         'booking', NULL,       NULL),
(2023, 8,  'Ronny Rylander',              'booking', NULL,       NULL),
(2023, 9,  'Göran Stark / Honken',        'booking', NULL,       NULL),
(2023, 10, 'Uffe Bivemark, pensionär',    'booking', NULL,       'ons–lör'),
(2023, 11, 'Johan Kroon, TB',             'booking', NULL,       NULL),
(2023, 12, 'Ralf Lönngren, KT',           'booking', '2000',     NULL),
(2023, 14, 'Göran Stark',                 'booking', NULL,       NULL),
(2023, 15, 'Gunnar Neselius, JO',         'booking', NULL,       NULL),
(2023, 16, 'Kristian Björndal, LÖ',       'booking', NULL,       NULL),
(2023, 19, 'Lasse Björk, TB',             'booking', NULL,       'larm'),
(2023, 20, 'Ulf Widell',                  'booking', NULL,       NULL),
(2023, 27, 'Ulf Blomqvist',               'booking', NULL,       NULL),
(2023, 28, 'Mälarn',                      'booking', NULL,       NULL),
(2023, 29, 'Anna Bofjäll Ståhle',         'booking', NULL,       NULL),
(2023, 30, 'Pelle Harju',                 'booking', NULL,       NULL),
(2023, 31, 'Pelle Harju',                 'booking', NULL,       NULL),
(2023, 32, 'Tommy Johansson',             'booking', '1500',     NULL),
(2023, 33, 'Jens Ahlstedt',              'booking', '1500',     NULL),
(2023, 35, 'Daniel Wigren',              'booking', '500+1500', NULL),
(2023, 36, 'Patrik Gustavsson',          'booking', NULL,       NULL),
(2023, 37, 'Lasse Björk, TB',            'booking', '2000+1200','larm'),
(2023, 40, 'Peter Lindgren',             'booking', '1500',     NULL),
(2023, 41, 'Magnus Bengtsson',           'booking', '2750',     '10–11 okt'),
(2023, 42, 'Magnus Bengtsson',           'booking', NULL,       NULL),
(2023, 44, 'Gunnar Neselius (Toa-installation)', 'maintenance', NULL, 'höstlov Sthlm'),
(2023, 51, 'Gunnar Neselius',            'booking', NULL,       NULL),
(2023, 52, 'Peter Lindgren',             'booking', '2500+500', NULL);

-- ============================================
-- 2024
-- ============================================
INSERT INTO public.legacy_bookings (year, week_number, booked_by_name, type, paid, notes) VALUES
(2024, 1,  'Johan Aarnio',                         'booking', NULL,       NULL),
(2024, 3,  'Anders Honken Holmqvist',              'booking', NULL,       NULL),
(2024, 6,  'Magnus Bengtsson',                     'booking', NULL,       NULL),
(2024, 7,  'Gunnar Neselius',                      'booking', NULL,       NULL),
(2024, 8,  'Uffe Bivemark',                        'booking', NULL,       NULL),
(2024, 9,  'Ronny Rylander',                       'booking', NULL,       NULL),
(2024, 11, 'Torbjörn Forslund',                    'booking', NULL,       NULL),
(2024, 12, 'Raffe Lönngren',                       'booking', NULL,       NULL),
(2024, 13, 'Göran Stark',                          'booking', NULL,       'obs utcheckning söndag'),
(2024, 14, 'Gunnar Neselius',                      'booking', NULL,       NULL),
(2024, 15, 'Daniel Wigren',                        'booking', NULL,       NULL),
(2024, 16, 'Håkan Arkeving',                       'booking', NULL,       NULL),
(2024, 17, 'Lasse Tuben Persson, KH',              'booking', NULL,       NULL),
(2024, 21, 'Brandinstruktörerna',                  'booking', NULL,       NULL),
(2024, 23, 'Lasse Björk',                          'booking', NULL,       NULL),
(2024, 26, 'Bosse Lindberg',                       'booking', NULL,       NULL),
(2024, 28, 'Mälarn',                               'booking', NULL,       '(Bokad av?) v29 Mälarn?'),
(2024, 29, 'Sören Jansson BM',                     'booking', '500',      'tidigare Roslagen'),
(2024, 30, 'Pelle Harju',                          'booking', '3500',     NULL),
(2024, 31, 'Pelle Harju',                          'booking', NULL,       NULL),
(2024, 32, 'Magnus Kark',                          'booking', '500+1500', NULL),
(2024, 33, 'Patrik Gustavsson',                    'booking', NULL,       NULL),
(2024, 39, 'Magnus Bengtsson',                     'booking', '2000',     NULL),
(2024, 40, 'Peter Lindgren',                       'booking', '500+1500', NULL),
(2024, 44, 'Kalle Friden, FA',                     'booking', '2000',     NULL),
(2024, 52, 'Peter Lindgren',                       'booking', '3000',     NULL);

-- ============================================
-- 2025
-- ============================================
INSERT INTO public.legacy_bookings (year, week_number, booked_by_name, type, paid, notes) VALUES
(2025, 1,  'Johan Aarnio',                                      'booking', '500+3834',      NULL),
(2025, 6,  'Björn Hallerby fd 212',                             'booking', '500+1500+730',  NULL),
(2025, 7,  'Henrik Norberg',                                    'booking', '500+756+1500',  NULL),
(2025, 8,  'Peter Thunholm KH',                                 'booking', '500+996+1500',  NULL),
(2025, 9,  'Ronny Rylander',                                    'booking', '676+3000',      NULL),
(2025, 10, 'Gunnar Neselius',                                   'booking', NULL,            NULL),
(2025, 11, 'Göran Stark',                                       'booking', NULL,            NULL),
(2025, 12, 'Tintin',                                            'booking', '2000',          NULL),
(2025, 13, 'Peter Lindgren',                                    'booking', '2000',          NULL),
(2025, 14, 'Håkan Arkeving',                                    'booking', NULL,            NULL),
(2025, 15, 'Julia Åberg, KI',                                   'booking', '500+244+1500',  NULL),
(2025, 17, 'Uffe Bivemark',                                     'booking', '500+150+2500',  NULL),
(2025, 18, 'Lasse Björk',                                       'booking', '500',           NULL),
(2025, 24, 'Bo Lindberg',                                       'booking', '134+1258+500',  NULL),
(2025, 25, 'Magnus Bengtsson',                                  'booking', '1200+500',      NULL),
(2025, 26, 'Pontus Bengtsson/Johansson',                        'booking', '500+222+1200',  NULL),
(2025, 27, 'Jonas Krantz',                                      'booking', '126+2000',      'Reserv: Lilo?'),
(2025, 28, 'Therese Blades',                                    'booking', '179+2000',      NULL),
(2025, 29, 'Magnus Kark',                                       'booking', '500+1500+338',  NULL),
(2025, 30, 'Pelle Harju',                                       'booking', '314+4000',      NULL),
(2025, 31, 'Pelle Harju',                                       'booking', NULL,            NULL),
(2025, 32, 'Alf Numminen',                                      'booking', '500+1500+222',  NULL),
(2025, 34, 'Tommy Johansson, fd 159',                           'booking', '500+1500+218',  NULL),
(2025, 37, 'Bengt Ring',                                        'booking', '1500+500',      NULL),
(2025, 52, 'Christoffer Alm',                                   'booking', '500+2500+1128', 'Ej: Johannes Kestad, Magnus Blomgren');

-- ============================================
-- 2026 — Bekräftade bokningar + reservlista
-- ============================================
INSERT INTO public.legacy_bookings (year, week_number, booked_by_name, reserve_name, type, paid, notes) VALUES
(2026, 1,  'Johan Aarnio',        'Magnus Blomgren',                          'booking', '500',           NULL),
(2026, 2,  'Magnus Kark',         NULL,                                       'booking', '500',           NULL),
(2026, 4,  'Christoffer Möller',  NULL,                                       'booking', NULL,            NULL),
(2026, 5,  'Ann Forsyth',         NULL,                                       'booking', '500',           NULL),
(2026, 6,  'Peter Thunholm',      NULL,                                       'booking', '500',           NULL),
(2026, 8,  'Göran Stark',         NULL,                                       'booking', NULL,            NULL),
(2026, 9,  'Carl Holmberg',       'Gunnar Neselius / Johan Aarnio (2:a hand)','booking', '500',           NULL),
(2026, 10, 'Gunnar Neselius',     NULL,                                       'booking', NULL,            NULL),
(2026, 12, 'Simon Ahlgren',       'Torbjörn Forslund',                        'booking', '500',           NULL),
(2026, 13, 'Göran Stark',         NULL,                                       'booking', NULL,            NULL),
(2026, 14, 'Peter Lindgren',      NULL,                                       'booking', NULL,            NULL),
(2026, 15, 'Gunnar Neselius',     'Magnus Bengtsson',                         'booking', NULL,            NULL),
(2026, 16, 'Kristian Björndalen', NULL,                                       'booking', NULL,            NULL),
(2026, 20, 'Julia Åberg',         NULL,                                       'booking', NULL,            NULL),
(2026, 26, 'Ali Saari',           NULL,                                       'booking', NULL,            NULL),
(2026, 28, 'Mälarn',              NULL,                                       'booking', NULL,            NULL),
(2026, 29, 'Pontus Johansson',    NULL,                                       'booking', NULL,            NULL),
(2026, 30, 'Theres Blades',       NULL,                                       'booking', NULL,            NULL),
(2026, 31, 'Pelle Harju',         NULL,                                       'booking', NULL,            NULL),
(2026, 32, 'Pelle Harju',         NULL,                                       'booking', NULL,            NULL),
(2026, 33, 'Magnus Kark',         NULL,                                       'booking', NULL,            NULL),
(2026, 34, 'David Justesen',      NULL,                                       'booking', NULL,            NULL),
(2026, 35, 'Tommy Johansson',     NULL,                                       'booking', NULL,            NULL);

-- ============================================
-- 2027 — Intresselistan (inför kommande lottning)
-- ============================================
INSERT INTO public.legacy_bookings (year, week_number, booked_by_name, type, notes) VALUES
(2027, 9,  'Johan Rossi',    'interest', 'Intresselistan'),
(2027, 9,  'Carl Holmberg',  'interest', 'Intresselistan'),
(2027, 10, 'Boden LÖ',       'interest', 'Intresselistan'),
(2027, 11, 'Boden LÖ',       'interest', 'Intresselistan'),
(2027, 12, 'Boden LÖ',       'interest', 'Intresselistan'),
(2027, 13, 'Boden LÖ',       'interest', 'Intresselistan');
