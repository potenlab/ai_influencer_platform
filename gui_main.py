import PySimpleGUI as sg
from config import Config
from fal_api import FalClient
from openrouter_client import OpenRouterClient
from services import CharacterService, ContentService, MediaService

sg.theme('DarkBlue3')

class App:
    def __init__(self):
        Config.init_directories()

        # Initialize clients
        self.fal_client = FalClient(Config.FAL_KEY)
        self.llm_client = OpenRouterClient(Config.OPENROUTER_API_KEY, Config.OPENROUTER_MODEL)

        # Initialize services
        self.char_service = CharacterService(self.fal_client, self.llm_client)
        self.content_service = ContentService(self.llm_client)
        self.media_service = MediaService(self.fal_client)

        self.selected_character = None
        self.current_plan = None

    def main_menu(self):
        layout = [
            [sg.Text('AI Influencer Studio', font=('Arial', 20, 'bold'))],
            [sg.Text('')],
            [sg.Button('Create New Character', size=(30, 2))],
            [sg.Button('Select Character', size=(30, 2))],
            [sg.Button('Plan Content', size=(30, 2), disabled=True, key='-PLAN-')],
            [sg.Button('Generate Media', size=(30, 2), disabled=True, key='-GENERATE-')],
            [sg.Text('')],
            [sg.Text('', key='-STATUS-', size=(40, 1))],
            [sg.Button('Exit')]
        ]

        return sg.Window('AI Influencer Studio', layout, size=(500, 400))

    def run(self):
        window = self.main_menu()

        while True:
            event, values = window.read()

            if event in (sg.WIN_CLOSED, 'Exit'):
                break

            if event == 'Create New Character':
                char = self.create_character_screen()
                if char:
                    window['-STATUS-'].update(f'Created: {char.name}')

            elif event == 'Select Character':
                char = self.select_character_screen()
                if char:
                    self.selected_character = char
                    window['-STATUS-'].update(f'Selected: {char.name}')
                    window['-PLAN-'].update(disabled=False)

            elif event == '-PLAN-':
                if self.selected_character:
                    self.content_planning_screen()
                    window['-GENERATE-'].update(disabled=False)

            elif event == '-GENERATE-':
                if self.selected_character:
                    self.media_generation_screen()

        window.close()

    def create_character_screen(self):
        layout = [
            [sg.Text('Create New Character', font=('Arial', 16))],
            [sg.Text('Name:'), sg.Input(key='-NAME-', size=(40, 1))],
            [sg.Text('Concept:'), sg.Multiline(key='-CONCEPT-', size=(50, 3))],
            [sg.Text('Target Audience:'), sg.Input(key='-AUDIENCE-', size=(40, 1))],
            [sg.Text('')],
            [sg.Button('Generate Character'), sg.Button('Cancel')],
            [sg.Text('', key='-CREATE_STATUS-', size=(50, 2))]
        ]

        window = sg.Window('Create Character', layout, modal=True)
        result = None

        while True:
            event, values = window.read()

            if event in (sg.WIN_CLOSED, 'Cancel'):
                break

            if event == 'Generate Character':
                name = values['-NAME-'].strip()
                concept = values['-CONCEPT-'].strip()
                audience = values['-AUDIENCE-'].strip()

                if not name or not concept:
                    sg.popup_error('Name and Concept are required')
                    continue

                window['-CREATE_STATUS-'].update('Generating personality and image...')
                window.refresh()

                try:
                    result = self.char_service.create_character(name, concept, audience)
                    sg.popup(f'Character "{name}" created!')
                    break
                except Exception as e:
                    sg.popup_error(f'Error: {str(e)}')

        window.close()
        return result

    def select_character_screen(self):
        characters = self.char_service.get_all_characters()

        if not characters:
            sg.popup('No characters found. Create one first!')
            return None

        char_list = [f"{c.name} - {c.content_style}" for c in characters]

        layout = [
            [sg.Text('Select Character', font=('Arial', 16))],
            [sg.Listbox(char_list, size=(60, 10), key='-CHAR_LIST-', enable_events=True)],
            [sg.Text('Details:')],
            [sg.Multiline('', size=(60, 8), key='-DETAILS-', disabled=True)],
            [sg.Button('Select'), sg.Button('Cancel')]
        ]

        window = sg.Window('Select Character', layout, modal=True, size=(700, 500))
        result = None

        while True:
            event, values = window.read()

            if event in (sg.WIN_CLOSED, 'Cancel'):
                break

            if event == '-CHAR_LIST-':
                if values['-CHAR_LIST-']:
                    idx = char_list.index(values['-CHAR_LIST-'][0])
                    char = characters[idx]
                    details = f"Name: {char.name}\nTraits: {', '.join(char.personality_traits)}\nTone: {char.tone_of_voice}\nAudience: {char.target_audience}"
                    window['-DETAILS-'].update(details)

            if event == 'Select':
                if values['-CHAR_LIST-']:
                    idx = char_list.index(values['-CHAR_LIST-'][0])
                    result = characters[idx]
                    break

        window.close()
        return result

    def content_planning_screen(self):
        layout = [
            [sg.Text(f'Plan Content for: {self.selected_character.name}', font=('Arial', 14))],
            [sg.Text('Theme:'), sg.Input(key='-THEME-', size=(50, 1))],
            [sg.Text('Platform:'), sg.Combo(['instagram', 'tiktok', 'youtube'], key='-PLATFORM-', default_value='instagram')],
            [sg.Button('Generate Plan'), sg.Button('Close')],
            [sg.Text('')],
            [sg.Multiline('', size=(80, 15), key='-PLAN-', disabled=True)]
        ]

        window = sg.Window('Content Planning', layout, modal=True, size=(900, 500))

        while True:
            event, values = window.read()

            if event in (sg.WIN_CLOSED, 'Close'):
                break

            if event == 'Generate Plan':
                theme = values['-THEME-'].strip()
                if not theme:
                    sg.popup_error('Theme is required')
                    continue

                try:
                    plan = self.content_service.create_content_plan(
                        self.selected_character,
                        theme,
                        values['-PLATFORM-']
                    )
                    self.current_plan = plan

                    # Format for display
                    output = f"Title: {plan.title}\n\nHook: {plan.hook}\n\nScenes:\n"
                    for scene in plan.scenes:
                        output += f"\n{scene.scene_number}. {scene.description} ({scene.duration_seconds}s)\n"
                    output += f"\nCTA: {plan.call_to_action}"

                    window['-PLAN-'].update(output)
                    sg.popup('Content plan generated!')
                except Exception as e:
                    sg.popup_error(f'Error: {str(e)}')

        window.close()

    def media_generation_screen(self):
        if not self.current_plan:
            sg.popup_error('No content plan found. Create one first.')
            return

        layout = [
            [sg.Text(f'Generate Media: {self.current_plan.title}', font=('Arial', 14))],
            [sg.Radio('Images', 'TYPE', key='-IMAGES-', default=True),
             sg.Radio('Videos', 'TYPE', key='-VIDEOS-')],
            [sg.Button('Generate All Scenes'), sg.Button('Close')],
            [sg.Text('')],
            [sg.ProgressBar(100, orientation='h', size=(60, 20), key='-PROGRESS-')],
            [sg.Text('', key='-GEN_STATUS-', size=(70, 2))]
        ]

        window = sg.Window('Media Generation', layout, modal=True, size=(800, 300))

        while True:
            event, values = window.read()

            if event in (sg.WIN_CLOSED, 'Close'):
                break

            if event == 'Generate All Scenes':
                is_video = values['-VIDEOS-']
                total = len(self.current_plan.scenes)

                for i, scene in enumerate(self.current_plan.scenes):
                    window['-GEN_STATUS-'].update(f'Generating scene {i+1}/{total}...')
                    window['-PROGRESS-'].update(int((i/total) * 100))
                    window.refresh()

                    try:
                        if is_video:
                            path = self.media_service.generate_scene_video(
                                scene, self.current_plan.id, scene.scene_number
                            )
                        else:
                            path = self.media_service.generate_scene_image(
                                scene, self.current_plan.id, scene.scene_number
                            )
                        print(f"Generated: {path}")
                    except Exception as e:
                        sg.popup_error(f'Scene {i+1} failed: {str(e)}')

                window['-PROGRESS-'].update(100)
                window['-GEN_STATUS-'].update('All scenes generated!')
                sg.popup(f'Generated {total} scenes!')

        window.close()

if __name__ == '__main__':
    app = App()
    app.run()
