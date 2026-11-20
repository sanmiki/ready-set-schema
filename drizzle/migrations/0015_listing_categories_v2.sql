insert into public.categories (name, slug, parent_id)
select v.name, v.slug, (select id from public.categories where slug='unisex')
from (values
 ('შარვლები','pants'),('ორნაწილიანი ნაკრები','two-piece-sets'),('პერანგები','shirts'),
 ('წინდები','socks'),('ლეგინსები','leggings'),('ბოდეები','bodysuits'),('ქვედაბოლოები','skirts'),
 ('გამოსაშვები კაბები','evening-dresses'),('საწვიმარები','raincoats'),('შორტები','shorts'),
 ('კოსტიუმები','suits'),('საქორწილო კაბები','wedding-dresses'),('სმოკინგები','tuxedos'),('ხალათები','robes')
) v(name,slug)
where not exists (select 1 from public.categories c where c.slug=v.slug);