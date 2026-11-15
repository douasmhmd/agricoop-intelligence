-- Deux événements de test pour le relais : un valide, un non conforme (avec un téléphone).
-- un événement valide
insert into outbox (coop_id, type, payload)
select coop_id, 'qr_scanne',
       jsonb_build_object('scan_id', gen_random_uuid(), 'qr_id', gen_random_uuid(),
                          'niveau', 'unite', 'date_scan', now(), 'ville', 'Rabat')
from cooperative where code = 'COOP01';
-- un événement NON conforme : il contient un téléphone
insert into outbox (coop_id, type, payload)
select coop_id, 'qr_scanne',
       jsonb_build_object('scan_id', gen_random_uuid(), 'qr_id', gen_random_uuid(),
                          'niveau', 'unite', 'date_scan', now(), 'ville', 'Rabat',
                          'telephone', '0600000000')
from cooperative where code = 'COOP01';
