-- Seed 20 scenario pairs across 8 taste dimensions
INSERT INTO scenario_pairs (dimension, prompt, option_a_label, option_a_description, option_b_label, option_b_description, vector_direction, display_order, active) VALUES

-- Quiet / Lively (dim 0)
('quiet_lively',
 'Your first evening in a city you''ve never been to.',
 'Wine bar', 'A quiet counter with no menu. The bartender picks for you.',
 'Night market', 'Smoke and noise and strangers. You''ll figure it out.',
 '{1,0,0,0,0,0,0,0}', 1, true),

('quiet_lively',
 'It''s your last night. You want to remember this one.',
 'Candlelit dinner', 'Somewhere small. Six tables. Nobody rushes you.',
 'Rooftop with a crowd', 'Music, people everywhere, the whole city laid out below.',
 '{1,0,0,0,0,0,0,0}', 2, true),

-- Budget / Splurge (dim 1)
('budget_splurge',
 'Someone says you have to try one place before you leave.',
 'Street cart', 'Plastic stool, paper plate, five dollars. Perfection.',
 'Tasting menu', 'Seven courses, paired wines, a meal you''ll talk about for years.',
 '{0,1,0,0,0,0,0,0}', 3, true),

('budget_splurge',
 'You''re celebrating something. Dinner is on you.',
 'The local spot', 'Cash only, family-run, portions meant for sharing.',
 'The reservation', 'You booked this weeks ago. Jacket optional but you wore one.',
 '{0,1,0,0,0,0,0,0}', 4, true),

-- Solo / Social (dim 2)
('solo_social',
 'You''ve got a free afternoon in a neighborhood you love.',
 'Wander alone', 'Headphones in, ducking into shops, no one to consult.',
 'Call someone', 'This is better with company. You know exactly who.',
 '{0,0,1,0,0,0,0,0}', 5, true),

('solo_social',
 'You found an incredible little restaurant.',
 'Counter seat', 'Just you and the chef. You don''t even need conversation.',
 'Big table', 'Bring everyone. Order the whole menu. Pass plates.',
 '{0,0,1,0,0,0,0,0}', 6, true),

-- Cautious / Adventurous (dim 3)
('cautious_adventurous',
 'The menu is entirely in a language you don''t speak.',
 'Ask for a translation', 'You''d rather know what you''re getting into.',
 'Point at something', 'Surprises are the whole point of being here.',
 '{0,0,0,1,0,0,0,0}', 7, true),

('cautious_adventurous',
 'A local insists you try something unusual.',
 'Politely pass', 'You have a pretty good sense of what you enjoy.',
 'Try it blind', 'That''s what travel is for. Worst case, it''s a story.',
 '{0,0,0,1,0,0,0,0}', 8, true),

-- Linger / Move (dim 4)
('linger_move',
 'You have one full day. No plans.',
 'One perfect spot', 'Find a cafe. Stay for hours. Let the afternoon happen.',
 'Cover ground', 'Three neighborhoods, four cafes, a museum. You''ll rest later.',
 '{0,0,0,0,1,0,0,0}', 9, true),

('linger_move',
 'You find a beautiful square with a cafe and a view.',
 'Order a second coffee', 'You could sit here all day and not be bored.',
 'Take a photo, keep walking', 'There''s so much more to see around the next corner.',
 '{0,0,0,0,1,0,0,0}', 10, true),

-- Morning / Night (dim 5)
('morning_night',
 'When does a city show you its real self?',
 'Early morning', 'Bakers, empty streets, the light before anyone else is up.',
 'Late night', 'After dark, when the locals come out and the tourists go to bed.',
 '{0,0,0,0,0,1,0,0}', 11, true),

('morning_night',
 'Your ideal first hour in a new place.',
 'Coffee and a pastry', 'Jet lag is real. Find the best cafe within walking distance.',
 'Drinks and dinner', 'Drop your bags and go. The city is waiting.',
 '{0,0,0,0,0,1,0,0}', 12, true),

-- Food-focused / Broad (dim 6)
('food_broad',
 'You''re planning three days in a new city.',
 'Eating itinerary', 'Breakfast, lunch, dinner, snacks. The food IS the trip.',
 'A bit of everything', 'Museums, markets, a park, a neighborhood walk. Food fits in.',
 '{0,0,0,0,0,0,1,0}', 13, true),

('food_broad',
 'A friend asks what made the trip special.',
 'The meals', 'That pasta, that bakery, that thing you ate standing up.',
 'The moments', 'Getting lost, a sunset, a conversation with a stranger.',
 '{0,0,0,0,0,0,1,0}', 14, true),

-- Planned / Spontaneous (dim 7)
('planned_spontaneous',
 'You arrive somewhere for the first time.',
 'Check your list', 'You''ve saved twelve places. You know exactly where to start.',
 'Start walking', 'No plan. You''ll know the right place when you see it.',
 '{0,0,0,0,0,0,0,1}', 15, true),

('planned_spontaneous',
 'How do you find the best places?',
 'Research', 'Blogs, lists, asking friends. You come prepared.',
 'Stumble in', 'The best places aren''t on anyone''s list. You just find them.',
 '{0,0,0,0,0,0,0,1}', 16, true),

-- Multi-dimension pairs
('budget_splurge+cautious_adventurous',
 'A taxi driver tells you about his favorite place to eat.',
 'The safe pick', 'A well-known restaurant where you can read the menu first.',
 'His actual spot', 'Down an alley, no sign, no English, incredible food. Maybe.',
 '{0,1,0,1,0,0,0,0}', 17, true),

('quiet_lively+solo_social',
 'Saturday night. You''ve been traveling for a week.',
 'Room service', 'A book, something simple, your own company. Bliss.',
 'Ask the concierge', 'Where are people going tonight? You want to be there.',
 '{1,0,1,0,0,0,0,0}', 18, true),

('linger_move+planned_spontaneous',
 'You wake up with no alarm in a city you''re starting to love.',
 'Return to your favorite spot', 'You''ve been thinking about that corner table since yesterday.',
 'Try somewhere new', 'You saw a side street yesterday. Today you follow it.',
 '{0,0,0,0,1,0,0,1}', 19, true),

('morning_night+food_broad',
 'You have 24 hours left. What do you do first?',
 'Dawn at the market', 'Watch the city wake up. Espresso. Fresh bread. Locals only.',
 'One last night out', 'Gallery, dinner, bar, somewhere you haven''t been yet.',
 '{0,0,0,0,0,1,1,0}', 20, true);
