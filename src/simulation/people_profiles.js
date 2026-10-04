// Adult residents share animation/physics; appearance and decisions come from a role.
export const PEOPLE_TYPES=Object.freeze({
  resident:{name:'Житель',pace:.44,fear:1,report:1.2,activity:'shopping',build:.95,accessory:'none'},
  commuter:{name:'Служащий',pace:.59,fear:1.1,report:1,activity:'checkingPhone',build:.9,accessory:'glasses'},
  worker:{name:'Рабочий',pace:.46,fear:.8,report:1.1,activity:'coffee',build:1.08,accessory:'hardhat'},
  jogger:{name:'Бегун',pace:.78,fear:.9,report:1.5,activity:'resting',build:.87,accessory:'cap'},
  elderly:{name:'Пожилой',pace:.30,fear:1.35,report:1.8,activity:'reading',build:.92,accessory:'glasses'},
  tourist:{name:'Турист',pace:.4,fear:1.15,report:1.6,activity:'looking',build:1,accessory:'backpack'},
  security:{name:'Охранник',pace:.48,fear:.55,report:.55,activity:'looking',build:1.08,accessory:'vest',weapon:'pistol'},
  troublemaker:{name:'Задира',pace:.52,fear:.65,report:2,activity:'talking',build:1.04,accessory:'beard',weapon:'bat'}
});
const distribution=['resident','commuter','worker','resident','tourist','elderly','jogger','resident','commuter','worker','tourist','resident','commuter','elderly','security','troublemaker'];
const skin=['#d1a685','#af7959','#e0bc99','#845940','#ba8c6a'];
export function assignPeopleTypes(people){
  people.forEach((p,index)=>{
    p.personType ||= p.beachRoute?'tourist':distribution[index%distribution.length];
    const profile=PEOPLE_TYPES[p.personType]||PEOPLE_TYPES.resident;
    p.hp??=100;p.personId??=index;p.walkSpeed=profile.pace;p.bodyBuild=profile.build;
    p.skin=skin[index%skin.length];p.accessory=profile.accessory;p.gender=index%3===0?'woman':'man';
    if(p.personType==='elderly'&&Math.floor(index/16)%2)p.accessory='scarf';
    if(p.accessory==='beard'&&p.gender==='woman')p.accessory='cap';
    p.hair=p.personType==='elderly'?'#a7a19b':index%7===0?'#9c9690':index%4===0?'#71553c':'#302720';
    p.visualScale=p.personType==='elderly'?.93:p.personType==='jogger'?1.03:1;
    if(profile.weapon&&!p.beachRoute)p.weapon ||= p.personType==='troublemaker'&&index%3===0?'pistol':profile.weapon;
    if(p.dailyStops)for(const stop of p.dailyStops)if(!['swimming','beachWalk','sunbathing'].includes(stop.kind))stop.activity=profile.activity;
    if(p.personType==='security'){p.shirt='#3b4954';p.pants='#28323c';}
    if(p.personType==='worker')p.shirt='#9b784a';
    if(p.personType==='jogger'){p.shirt='#759a99';p.pants='#3a4652';}
  });
}
export const peopleProfile=p=>PEOPLE_TYPES[p.personType]||PEOPLE_TYPES.resident;
